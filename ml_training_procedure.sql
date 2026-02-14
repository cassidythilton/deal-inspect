-- ============================================================================
-- ML TRAINING PROCEDURE: Stacking Ensemble for Deal Close Propensity
-- ============================================================================
-- This file contains:
--   1. SP_TRAIN_STACKING_ENSEMBLE - Main training procedure
--   2. SP_PREDICT_WIN_PROBABILITY - Batch/single prediction with SHAP explanations
-- ============================================================================

-- ============================================================================
-- PROCEDURE 1: Training Procedure for Stacking Ensemble Model
-- ============================================================================
CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.SP_TRAIN_STACKING_ENSEMBLE(
    SOURCE_TABLE VARCHAR DEFAULT 'DOMO_DB.DOMO_SCHEMA.OPPORTUNITIESMAGIC',
    MODEL_VERSION VARCHAR DEFAULT NULL,
    HANDLE_IMBALANCE VARCHAR DEFAULT 'smote',  -- 'smote', 'class_weight', or 'none'
    TEST_SIZE FLOAT DEFAULT 0.2,
    RANDOM_STATE INT DEFAULT 42,
    TRAINING_NOTES VARCHAR DEFAULT NULL
)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.10'
PACKAGES = (
    'snowflake-snowpark-python',
    'pandas',
    'numpy',
    'scikit-learn',
    'xgboost',
    'lightgbm',
    'imbalanced-learn',
    'shap',
    'joblib'
)
HANDLER = 'train_stacking_ensemble'
EXECUTE AS CALLER
AS
$$
import pandas as pd
import numpy as np
import json
import uuid
import joblib
import io
from datetime import datetime
from typing import Dict, List, Tuple, Any

from snowflake.snowpark import Session
from snowflake.snowpark.functions import col

from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score, average_precision_score, f1_score,
    precision_score, recall_score, brier_score_loss,
    classification_report, confusion_matrix
)

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

try:
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True
except ImportError:
    SMOTE_AVAILABLE = False

import shap


def train_stacking_ensemble(
    session: Session,
    source_table: str,
    model_version: str,
    handle_imbalance: str,
    test_size: float,
    random_state: int,
    training_notes: str
) -> dict:
    """
    Train a stacking ensemble model for deal close propensity prediction.
    
    Base models: XGBoost, LightGBM, RandomForest, LogisticRegression
    Meta-learner: LogisticRegression
    
    Uses 5-fold stratified CV for out-of-fold predictions to train meta-learner.
    """
    
    # Generate model version if not provided
    if model_version is None:
        model_version = f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    model_id = str(uuid.uuid4())
    training_start = datetime.now()
    
    # Define feature columns (matching ML_FEATURE_STORE)
    feature_columns = [
        'ACCOUNT_WIN_RATE',
        'TYPE_SPECIFIC_WIN_RATE',
        'STAGE_VELOCITY_RATIO',
        'QUARTER_URGENCY',
        'DAYS_IN_CURRENT_STAGE',
        'DAYS_SINCE_CREATED',
        'DEAL_COMPLEXITY_INDEX',
        'COMPETITOR_COUNT',
        'LINE_ITEM_COUNT',
        'SERVICES_RATIO',
        'ACV_NORMALIZED',
        'REVENUE_PER_EMPLOYEE',
        'SALES_PROCESS_COMPLETENESS',
        'STEPS_COMPLETED',
        'HAS_THESIS',
        'HAS_STAKEHOLDERS',
        'STAGE_ORDINAL',
        'DEAL_COMPLEXITY_ENCODED',
        'AI_MATURITY_ENCODED'
    ]
    
    # -------------------------------------------------------------------------
    # Step 1: Load and prepare training data
    # -------------------------------------------------------------------------
    training_query = f"""
    SELECT 
        fs.OPPORTUNITY_ID,
        fs.ACCOUNT_WIN_RATE,
        fs.TYPE_SPECIFIC_WIN_RATE,
        fs.STAGE_VELOCITY_RATIO,
        fs.QUARTER_URGENCY,
        fs.DAYS_IN_CURRENT_STAGE,
        fs.DAYS_SINCE_CREATED,
        fs.DEAL_COMPLEXITY_INDEX,
        fs.COMPETITOR_COUNT,
        fs.LINE_ITEM_COUNT,
        fs.SERVICES_RATIO,
        fs.ACV_NORMALIZED,
        fs.REVENUE_PER_EMPLOYEE,
        fs.SALES_PROCESS_COMPLETENESS,
        fs.STEPS_COMPLETED,
        CASE WHEN fs.HAS_THESIS THEN 1 ELSE 0 END AS HAS_THESIS,
        CASE WHEN fs.HAS_STAKEHOLDERS THEN 1 ELSE 0 END AS HAS_STAKEHOLDERS,
        fs.STAGE_ORDINAL,
        fs.DEAL_COMPLEXITY_ENCODED,
        fs.AI_MATURITY_ENCODED,
        CASE WHEN opp."Is Won" = TRUE THEN 1 ELSE 0 END AS WIN_LABEL
    FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE fs
    INNER JOIN {source_table} opp 
        ON fs.OPPORTUNITY_ID = opp."Opportunity Id"
    WHERE opp."Is Won" IS NOT NULL
    QUALIFY ROW_NUMBER() OVER (PARTITION BY fs.OPPORTUNITY_ID ORDER BY fs.FEATURE_DATE DESC) = 1
    """
    
    df = session.sql(training_query).to_pandas()
    
    if len(df) < 100:
        raise ValueError(f"Insufficient training data: {len(df)} rows. Need at least 100.")
    
    # Separate features and target
    X = df[feature_columns].copy()
    y = df['WIN_LABEL'].values
    opportunity_ids = df['OPPORTUNITY_ID'].values
    
    # Handle missing values
    X = X.fillna(X.median())
    
    # Convert boolean columns to int
    for col_name in ['HAS_THESIS', 'HAS_STAKEHOLDERS']:
        if col_name in X.columns:
            X[col_name] = X[col_name].astype(int)
    
    # Record class distribution
    n_positive = int(y.sum())
    n_negative = int(len(y) - n_positive)
    class_ratio = n_positive / len(y)
    
    # -------------------------------------------------------------------------
    # Step 2: Train/test split
    # -------------------------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    
    # -------------------------------------------------------------------------
    # Step 3: Handle class imbalance
    # -------------------------------------------------------------------------
    class_weight_param = None
    X_train_resampled = X_train.copy()
    y_train_resampled = y_train.copy()
    
    if handle_imbalance == 'smote' and SMOTE_AVAILABLE:
        smote = SMOTE(random_state=random_state)
        X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)
    elif handle_imbalance == 'class_weight':
        class_weight_param = 'balanced'
    
    # -------------------------------------------------------------------------
    # Step 4: Feature scaling
    # -------------------------------------------------------------------------
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_resampled)
    X_test_scaled = scaler.transform(X_test)
    
    # For CV, we'll use the original training data
    X_train_cv_scaled = scaler.transform(X_train)
    
    # -------------------------------------------------------------------------
    # Step 5: Define base models
    # -------------------------------------------------------------------------
    base_models = {
        'xgboost': XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=(n_negative / n_positive) if handle_imbalance == 'class_weight' else 1,
            random_state=random_state,
            use_label_encoder=False,
            eval_metric='logloss'
        ),
        'lightgbm': LGBMClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            class_weight=class_weight_param,
            random_state=random_state,
            verbose=-1
        ),
        'random_forest': RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight=class_weight_param,
            random_state=random_state,
            n_jobs=-1
        ),
        'logistic_regression': LogisticRegression(
            C=1.0,
            max_iter=1000,
            class_weight=class_weight_param,
            random_state=random_state
        )
    }
    
    # -------------------------------------------------------------------------
    # Step 6: 5-Fold Stratified CV for Out-of-Fold predictions
    # -------------------------------------------------------------------------
    n_folds = 5
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=random_state)
    
    # Initialize OOF prediction arrays
    oof_predictions = {name: np.zeros(len(X_train)) for name in base_models.keys()}
    test_predictions = {name: np.zeros(len(X_test)) for name in base_models.keys()}
    
    # Store CV scores for each model
    cv_scores = {name: [] for name in base_models.keys()}
    
    # Train each base model with cross-validation
    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X_train_cv_scaled, y_train)):
        X_fold_train = X_train_cv_scaled[train_idx]
        y_fold_train = y_train[train_idx]
        X_fold_val = X_train_cv_scaled[val_idx]
        y_fold_val = y_train[val_idx]
        
        # Apply SMOTE to fold training data if needed
        if handle_imbalance == 'smote' and SMOTE_AVAILABLE:
            smote_fold = SMOTE(random_state=random_state)
            X_fold_train, y_fold_train = smote_fold.fit_resample(X_fold_train, y_fold_train)
        
        for name, model in base_models.items():
            # Clone model for this fold
            if name == 'xgboost':
                fold_model = XGBClassifier(**model.get_params())
            elif name == 'lightgbm':
                fold_model = LGBMClassifier(**model.get_params())
            elif name == 'random_forest':
                fold_model = RandomForestClassifier(**model.get_params())
            else:
                fold_model = LogisticRegression(**model.get_params())
            
            # Fit on fold training data
            fold_model.fit(X_fold_train, y_fold_train)
            
            # OOF predictions for validation fold
            oof_predictions[name][val_idx] = fold_model.predict_proba(X_fold_val)[:, 1]
            
            # Accumulate test predictions (averaged across folds)
            test_predictions[name] += fold_model.predict_proba(X_test_scaled)[:, 1] / n_folds
            
            # Track fold AUC
            fold_auc = roc_auc_score(y_fold_val, oof_predictions[name][val_idx])
            cv_scores[name].append(fold_auc)
    
    # -------------------------------------------------------------------------
    # Step 7: Train final base models on full training data
    # -------------------------------------------------------------------------
    final_base_models = {}
    for name, model in base_models.items():
        model.fit(X_train_scaled, y_train_resampled)
        final_base_models[name] = model
    
    # -------------------------------------------------------------------------
    # Step 8: Create meta-features and train meta-learner
    # -------------------------------------------------------------------------
    # Stack OOF predictions as meta-features
    meta_train = np.column_stack([oof_predictions[name] for name in base_models.keys()])
    meta_test = np.column_stack([test_predictions[name] for name in base_models.keys()])
    
    # Train meta-learner (Logistic Regression)
    meta_learner = LogisticRegression(
        C=1.0,
        max_iter=1000,
        random_state=random_state
    )
    meta_learner.fit(meta_train, y_train)
    
    # Final predictions
    final_train_preds = meta_learner.predict_proba(meta_train)[:, 1]
    final_test_preds = meta_learner.predict_proba(meta_test)[:, 1]
    
    # -------------------------------------------------------------------------
    # Step 9: Compute metrics
    # -------------------------------------------------------------------------
    metrics = {
        'train': compute_metrics(y_train, final_train_preds),
        'test': compute_metrics(y_test, final_test_preds)
    }
    
    # Add CV scores for each base model
    metrics['cv_scores'] = {
        name: {
            'mean_auc': float(np.mean(scores)),
            'std_auc': float(np.std(scores)),
            'fold_scores': [float(s) for s in scores]
        }
        for name, scores in cv_scores.items()
    }
    
    # Meta-learner coefficients (model weights)
    meta_weights = dict(zip(base_models.keys(), meta_learner.coef_[0].tolist()))
    metrics['meta_learner_weights'] = meta_weights
    
    # -------------------------------------------------------------------------
    # Step 10: Compute feature importance (averaged across base models)
    # -------------------------------------------------------------------------
    feature_importance = compute_ensemble_feature_importance(
        final_base_models, feature_columns, X_train_scaled
    )
    
    # -------------------------------------------------------------------------
    # Step 11: Compute SHAP values for explainability (using XGBoost)
    # -------------------------------------------------------------------------
    try:
        explainer = shap.TreeExplainer(final_base_models['xgboost'])
        shap_values = explainer.shap_values(X_test_scaled[:100])  # Sample for efficiency
        
        # Mean absolute SHAP values per feature
        shap_importance = dict(zip(
            feature_columns,
            np.abs(shap_values).mean(axis=0).tolist()
        ))
        metrics['shap_importance'] = shap_importance
    except Exception as e:
        metrics['shap_importance'] = {'error': str(e)}
    
    # -------------------------------------------------------------------------
    # Step 12: Save model artifacts to stage
    # -------------------------------------------------------------------------
    model_artifact = {
        'model_id': model_id,
        'model_version': model_version,
        'base_models': final_base_models,
        'meta_learner': meta_learner,
        'scaler': scaler,
        'feature_columns': feature_columns,
        'class_ratio': class_ratio,
        'training_date': training_start.isoformat()
    }
    
    # Serialize model
    model_buffer = io.BytesIO()
    joblib.dump(model_artifact, model_buffer)
    model_buffer.seek(0)
    model_bytes = model_buffer.read()
    model_size = len(model_bytes)
    
    # Upload to stage
    artifact_path = f"stacking_ensemble_{model_version}.joblib"
    stage_path = f"@TDR_APP.ML_MODELS.MODEL_ARTIFACTS/{artifact_path}"
    
    # Use PUT command via session
    session.file.put_stream(
        model_buffer,
        stage_path,
        auto_compress=False,
        overwrite=True
    )
    
    # -------------------------------------------------------------------------
    # Step 13: Register model in ML_MODEL_METADATA
    # -------------------------------------------------------------------------
    training_end = datetime.now()
    
    hyperparameters = {
        'base_models': {
            'xgboost': {'n_estimators': 200, 'max_depth': 6, 'learning_rate': 0.1},
            'lightgbm': {'n_estimators': 200, 'max_depth': 6, 'learning_rate': 0.1},
            'random_forest': {'n_estimators': 200, 'max_depth': 10},
            'logistic_regression': {'C': 1.0}
        },
        'meta_learner': {'algorithm': 'LogisticRegression', 'C': 1.0},
        'cv_folds': n_folds,
        'handle_imbalance': handle_imbalance,
        'test_size': test_size
    }
    
    # Insert into ML_MODEL_METADATA
    insert_sql = f"""
    INSERT INTO TDR_APP.ML_MODELS.ML_MODEL_METADATA (
        MODEL_ID,
        MODEL_NAME,
        MODEL_VERSION,
        STATUS,
        IS_PRODUCTION,
        ALGORITHM,
        HYPERPARAMETERS,
        FEATURE_LIST,
        FEATURE_VERSION,
        TRAINING_ROW_COUNT,
        POSITIVE_CLASS_COUNT,
        NEGATIVE_CLASS_COUNT,
        CLASS_WEIGHT_STRATEGY,
        VALIDATION_METRICS,
        AUC_ROC,
        AUC_PR,
        PRECISION_SCORE,
        RECALL_SCORE,
        F1_SCORE,
        BRIER_SCORE,
        CV_STRATEGY,
        CV_FOLDS,
        CV_SCORES,
        MODEL_ARTIFACT_PATH,
        MODEL_SIZE_BYTES,
        FEATURE_IMPORTANCE,
        TOP_FEATURES,
        CREATED_AT,
        TRAINED_AT,
        DESCRIPTION,
        TRAINING_NOTES
    ) VALUES (
        '{model_id}',
        'deal_close_propensity',
        '{model_version}',
        'VALIDATED',
        FALSE,
        'StackingEnsemble',
        PARSE_JSON($${json.dumps(hyperparameters)}$$),
        PARSE_JSON($${json.dumps(feature_columns)}$$),
        'v1',
        {len(df)},
        {n_positive},
        {n_negative},
        '{handle_imbalance}',
        PARSE_JSON($${json.dumps(metrics)}$$),
        {metrics['test']['auc_roc']},
        {metrics['test']['auc_pr']},
        {metrics['test']['precision']},
        {metrics['test']['recall']},
        {metrics['test']['f1']},
        {metrics['test']['brier_score']},
        'StratifiedKFold',
        {n_folds},
        PARSE_JSON($${json.dumps(metrics['cv_scores'])}$$),
        '{stage_path}',
        {model_size},
        PARSE_JSON($${json.dumps(feature_importance)}$$),
        PARSE_JSON($${json.dumps(get_top_features(feature_importance, 10))}$$),
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP(),
        'Stacking ensemble model with XGBoost, LightGBM, RandomForest, LogisticRegression base models and LogisticRegression meta-learner',
        {f"'{training_notes}'" if training_notes else 'NULL'}
    )
    """
    
    session.sql(insert_sql).collect()
    
    # -------------------------------------------------------------------------
    # Return training summary
    # -------------------------------------------------------------------------
    return {
        'status': 'SUCCESS',
        'model_id': model_id,
        'model_version': model_version,
        'artifact_path': stage_path,
        'training_rows': len(df),
        'class_distribution': {
            'positive': n_positive,
            'negative': n_negative,
            'ratio': class_ratio
        },
        'metrics': {
            'test_auc_roc': metrics['test']['auc_roc'],
            'test_auc_pr': metrics['test']['auc_pr'],
            'test_f1': metrics['test']['f1'],
            'test_precision': metrics['test']['precision'],
            'test_recall': metrics['test']['recall'],
            'test_brier_score': metrics['test']['brier_score']
        },
        'base_model_cv_aucs': {
            name: scores['mean_auc'] 
            for name, scores in metrics['cv_scores'].items()
        },
        'meta_learner_weights': meta_weights,
        'top_features': get_top_features(feature_importance, 5),
        'training_duration_seconds': (training_end - training_start).total_seconds()
    }


def compute_metrics(y_true: np.ndarray, y_pred_proba: np.ndarray) -> dict:
    """Compute all evaluation metrics."""
    y_pred = (y_pred_proba >= 0.5).astype(int)
    
    return {
        'auc_roc': float(roc_auc_score(y_true, y_pred_proba)),
        'auc_pr': float(average_precision_score(y_true, y_pred_proba)),
        'f1': float(f1_score(y_true, y_pred)),
        'precision': float(precision_score(y_true, y_pred)),
        'recall': float(recall_score(y_true, y_pred)),
        'brier_score': float(brier_score_loss(y_true, y_pred_proba)),
        'confusion_matrix': confusion_matrix(y_true, y_pred).tolist()
    }


def compute_ensemble_feature_importance(
    models: dict,
    feature_names: list,
    X_train: np.ndarray
) -> dict:
    """Compute averaged feature importance across base models."""
    importance_sum = np.zeros(len(feature_names))
    n_models = 0
    
    for name, model in models.items():
        if hasattr(model, 'feature_importances_'):
            importance_sum += model.feature_importances_
            n_models += 1
        elif hasattr(model, 'coef_'):
            importance_sum += np.abs(model.coef_[0])
            n_models += 1
    
    if n_models > 0:
        importance_avg = importance_sum / n_models
        # Normalize to sum to 1
        importance_avg = importance_avg / importance_avg.sum()
        return dict(zip(feature_names, importance_avg.tolist()))
    
    return {name: 0.0 for name in feature_names}


def get_top_features(importance: dict, n: int) -> list:
    """Get top N features by importance."""
    sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    return [{'feature': f, 'importance': round(i, 4)} for f, i in sorted_features[:n]]
$$;

-- Grant execute permission
GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SP_TRAIN_STACKING_ENSEMBLE(
    VARCHAR, VARCHAR, VARCHAR, FLOAT, INT, VARCHAR
) TO ROLE TDR_APP_ROLE;


-- ============================================================================
-- PROCEDURE 2: Prediction Procedure with SHAP Explanations
-- ============================================================================
CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.SP_PREDICT_WIN_PROBABILITY(
    MODE VARCHAR DEFAULT 'batch',  -- 'single' or 'batch'
    OPPORTUNITY_ID VARCHAR DEFAULT NULL,  -- Required for 'single' mode
    MODEL_VERSION VARCHAR DEFAULT NULL,  -- NULL = use production model
    BATCH_LIMIT INT DEFAULT 1000,
    INCLUDE_SHAP BOOLEAN DEFAULT TRUE
)
RETURNS VARIANT
LANGUAGE PYTHON
RUNTIME_VERSION = '3.10'
PACKAGES = (
    'snowflake-snowpark-python',
    'pandas',
    'numpy',
    'scikit-learn',
    'xgboost',
    'lightgbm',
    'shap',
    'joblib'
)
HANDLER = 'predict_win_probability'
EXECUTE AS CALLER
AS
$$
import pandas as pd
import numpy as np
import json
import uuid
import joblib
import io
from datetime import datetime
from typing import Dict, List, Optional, Any

from snowflake.snowpark import Session
from snowflake.snowpark.functions import col

import shap


def predict_win_probability(
    session: Session,
    mode: str,
    opportunity_id: str,
    model_version: str,
    batch_limit: int,
    include_shap: bool
) -> dict:
    """
    Generate win probability predictions with SHAP explanations.
    
    Modes:
    - 'single': Predict for a specific opportunity ID
    - 'batch': Predict for all opportunities in ML_FEATURE_STORE without recent predictions
    """
    
    prediction_start = datetime.now()
    
    # -------------------------------------------------------------------------
    # Step 1: Load model metadata and artifact
    # -------------------------------------------------------------------------
    if model_version is None:
        # Get production model
        model_query = """
        SELECT MODEL_ID, MODEL_VERSION, MODEL_ARTIFACT_PATH, FEATURE_LIST
        FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
        WHERE MODEL_NAME = 'deal_close_propensity'
          AND IS_PRODUCTION = TRUE
        ORDER BY TRAINED_AT DESC
        LIMIT 1
        """
    else:
        model_query = f"""
        SELECT MODEL_ID, MODEL_VERSION, MODEL_ARTIFACT_PATH, FEATURE_LIST
        FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
        WHERE MODEL_NAME = 'deal_close_propensity'
          AND MODEL_VERSION = '{model_version}'
        LIMIT 1
        """
    
    model_meta = session.sql(model_query).to_pandas()
    
    if len(model_meta) == 0:
        # If no production model, get latest validated model
        fallback_query = """
        SELECT MODEL_ID, MODEL_VERSION, MODEL_ARTIFACT_PATH, FEATURE_LIST
        FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
        WHERE MODEL_NAME = 'deal_close_propensity'
          AND STATUS = 'VALIDATED'
        ORDER BY TRAINED_AT DESC
        LIMIT 1
        """
        model_meta = session.sql(fallback_query).to_pandas()
        
        if len(model_meta) == 0:
            raise ValueError("No trained model found. Please run SP_TRAIN_STACKING_ENSEMBLE first.")
    
    model_id = model_meta['MODEL_ID'].iloc[0]
    model_version_used = model_meta['MODEL_VERSION'].iloc[0]
    artifact_path = model_meta['MODEL_ARTIFACT_PATH'].iloc[0]
    feature_list = json.loads(model_meta['FEATURE_LIST'].iloc[0])
    
    # -------------------------------------------------------------------------
    # Step 2: Load model artifact from stage
    # -------------------------------------------------------------------------
    # Download model from stage
    model_stream = session.file.get_stream(artifact_path)
    model_artifact = joblib.load(model_stream)
    
    base_models = model_artifact['base_models']
    meta_learner = model_artifact['meta_learner']
    scaler = model_artifact['scaler']
    feature_columns = model_artifact['feature_columns']
    
    # -------------------------------------------------------------------------
    # Step 3: Load features for prediction
    # -------------------------------------------------------------------------
    if mode == 'single':
        if opportunity_id is None:
            raise ValueError("OPPORTUNITY_ID is required for 'single' mode")
        
        feature_query = f"""
        SELECT 
            fs.OPPORTUNITY_ID,
            fs.ACCOUNT_ID,
            fs.FEATURE_DATE,
            fs.ACCOUNT_WIN_RATE,
            fs.TYPE_SPECIFIC_WIN_RATE,
            fs.STAGE_VELOCITY_RATIO,
            fs.QUARTER_URGENCY,
            fs.DAYS_IN_CURRENT_STAGE,
            fs.DAYS_SINCE_CREATED,
            fs.DEAL_COMPLEXITY_INDEX,
            fs.COMPETITOR_COUNT,
            fs.LINE_ITEM_COUNT,
            fs.SERVICES_RATIO,
            fs.ACV_NORMALIZED,
            fs.REVENUE_PER_EMPLOYEE,
            fs.SALES_PROCESS_COMPLETENESS,
            fs.STEPS_COMPLETED,
            CASE WHEN fs.HAS_THESIS THEN 1 ELSE 0 END AS HAS_THESIS,
            CASE WHEN fs.HAS_STAKEHOLDERS THEN 1 ELSE 0 END AS HAS_STAKEHOLDERS,
            fs.STAGE_ORDINAL,
            fs.DEAL_COMPLEXITY_ENCODED,
            fs.AI_MATURITY_ENCODED
        FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE fs
        WHERE fs.OPPORTUNITY_ID = '{opportunity_id}'
        QUALIFY ROW_NUMBER() OVER (PARTITION BY fs.OPPORTUNITY_ID ORDER BY fs.FEATURE_DATE DESC) = 1
        """
    else:  # batch mode
        feature_query = f"""
        SELECT 
            fs.OPPORTUNITY_ID,
            fs.ACCOUNT_ID,
            fs.FEATURE_DATE,
            fs.ACCOUNT_WIN_RATE,
            fs.TYPE_SPECIFIC_WIN_RATE,
            fs.STAGE_VELOCITY_RATIO,
            fs.QUARTER_URGENCY,
            fs.DAYS_IN_CURRENT_STAGE,
            fs.DAYS_SINCE_CREATED,
            fs.DEAL_COMPLEXITY_INDEX,
            fs.COMPETITOR_COUNT,
            fs.LINE_ITEM_COUNT,
            fs.SERVICES_RATIO,
            fs.ACV_NORMALIZED,
            fs.REVENUE_PER_EMPLOYEE,
            fs.SALES_PROCESS_COMPLETENESS,
            fs.STEPS_COMPLETED,
            CASE WHEN fs.HAS_THESIS THEN 1 ELSE 0 END AS HAS_THESIS,
            CASE WHEN fs.HAS_STAKEHOLDERS THEN 1 ELSE 0 END AS HAS_STAKEHOLDERS,
            fs.STAGE_ORDINAL,
            fs.DEAL_COMPLEXITY_ENCODED,
            fs.AI_MATURITY_ENCODED
        FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE fs
        LEFT JOIN TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS p
            ON fs.OPPORTUNITY_ID = p.OPPORTUNITY_ID
            AND p.PREDICTION_DATE >= DATEADD(day, -1, CURRENT_DATE())
        WHERE p.PREDICTION_ID IS NULL
        QUALIFY ROW_NUMBER() OVER (PARTITION BY fs.OPPORTUNITY_ID ORDER BY fs.FEATURE_DATE DESC) = 1
        LIMIT {batch_limit}
        """
    
    features_df = session.sql(feature_query).to_pandas()
    
    if len(features_df) == 0:
        return {
            'status': 'NO_DATA',
            'message': 'No opportunities found for prediction',
            'mode': mode,
            'opportunity_id': opportunity_id
        }
    
    # -------------------------------------------------------------------------
    # Step 4: Prepare features and generate predictions
    # -------------------------------------------------------------------------
    X = features_df[feature_columns].copy()
    X = X.fillna(X.median())
    
    # Scale features
    X_scaled = scaler.transform(X)
    
    # Generate base model predictions
    base_preds = {}
    for name, model in base_models.items():
        base_preds[name] = model.predict_proba(X_scaled)[:, 1]
    
    # Stack for meta-learner
    meta_features = np.column_stack([base_preds[name] for name in base_models.keys()])
    
    # Final predictions from meta-learner
    win_probabilities = meta_learner.predict_proba(meta_features)[:, 1]
    
    # -------------------------------------------------------------------------
    # Step 5: Compute SHAP explanations (if requested)
    # -------------------------------------------------------------------------
    shap_explanations = []
    
    if include_shap:
        try:
            # Use XGBoost for SHAP (tree-based, fast)
            explainer = shap.TreeExplainer(base_models['xgboost'])
            shap_values = explainer.shap_values(X_scaled)
            
            for i in range(len(features_df)):
                feature_contributions = dict(zip(feature_columns, shap_values[i].tolist()))
                
                # Sort by absolute impact
                sorted_contributions = sorted(
                    feature_contributions.items(),
                    key=lambda x: abs(x[1]),
                    reverse=True
                )
                
                # Top positive and negative factors
                top_positive = [
                    {'feature': f, 'impact': round(v, 4)}
                    for f, v in sorted_contributions if v > 0
                ][:5]
                
                top_negative = [
                    {'feature': f, 'impact': round(v, 4)}
                    for f, v in sorted_contributions if v < 0
                ][:5]
                
                shap_explanations.append({
                    'feature_contributions': {k: round(v, 4) for k, v in feature_contributions.items()},
                    'top_positive_factors': top_positive,
                    'top_negative_factors': top_negative
                })
        except Exception as e:
            # If SHAP fails, continue without explanations
            shap_explanations = [{'error': str(e)}] * len(features_df)
    else:
        shap_explanations = [None] * len(features_df)
    
    # -------------------------------------------------------------------------
    # Step 6: Classify predictions and compute confidence
    # -------------------------------------------------------------------------
    results = []
    for i in range(len(features_df)):
        prob = float(win_probabilities[i])
        
        # Classification with thresholds
        if prob >= 0.7:
            prediction_class = 'WIN'
            confidence = prob
        elif prob <= 0.3:
            prediction_class = 'LOSE'
            confidence = 1 - prob
        else:
            prediction_class = 'UNCERTAIN'
            confidence = 1 - abs(prob - 0.5) * 2
        
        # Identify risk flags
        risk_flags = []
        row = features_df.iloc[i]
        
        if row.get('DAYS_IN_CURRENT_STAGE', 0) > 30:
            risk_flags.append('STALLED_DEAL')
        if row.get('COMPETITOR_COUNT', 0) >= 3:
            risk_flags.append('HIGH_COMPETITION')
        if row.get('SALES_PROCESS_COMPLETENESS', 1) < 0.5:
            risk_flags.append('INCOMPLETE_PROCESS')
        if row.get('STAGE_VELOCITY_RATIO', 1) < 0.5:
            risk_flags.append('SLOW_PROGRESSION')
        if row.get('ACCOUNT_WIN_RATE', 0.5) < 0.2:
            risk_flags.append('LOW_ACCOUNT_WIN_RATE')
        
        result = {
            'opportunity_id': str(features_df.iloc[i]['OPPORTUNITY_ID']),
            'account_id': str(features_df.iloc[i]['ACCOUNT_ID']),
            'win_probability': round(prob, 4),
            'prediction_class': prediction_class,
            'confidence_score': round(confidence, 4),
            'risk_flags': risk_flags,
            'base_model_predictions': {
                name: round(float(base_preds[name][i]), 4)
                for name in base_models.keys()
            }
        }
        
        if shap_explanations[i] is not None:
            result['shap_explanation'] = shap_explanations[i]
        
        results.append(result)
    
    # -------------------------------------------------------------------------
    # Step 7: Store predictions in DEAL_ML_PREDICTIONS
    # -------------------------------------------------------------------------
    predictions_to_insert = []
    for i, result in enumerate(results):
        prediction_id = str(uuid.uuid4())
        
        predictions_to_insert.append({
            'PREDICTION_ID': prediction_id,
            'OPPORTUNITY_ID': result['opportunity_id'],
            'ACCOUNT_ID': result['account_id'],
            'MODEL_ID': model_id,
            'PREDICTION_DATE': datetime.now().date().isoformat(),
            'WIN_PROBABILITY': result['win_probability'],
            'PREDICTION_CLASS': result['prediction_class'],
            'CONFIDENCE_SCORE': result['confidence_score'],
            'RISK_FLAGS': result.get('risk_flags', []),
            'TOP_POSITIVE_FACTORS': result.get('shap_explanation', {}).get('top_positive_factors', []),
            'TOP_NEGATIVE_FACTORS': result.get('shap_explanation', {}).get('top_negative_factors', []),
            'FEATURE_CONTRIBUTIONS': result.get('shap_explanation', {}).get('feature_contributions', {}),
            'FEATURE_SNAPSHOT': features_df.iloc[i][feature_columns].to_dict()
        })
    
    # Batch insert predictions
    if predictions_to_insert:
        predictions_df = pd.DataFrame(predictions_to_insert)
        
        # Convert dict columns to JSON strings
        for col_name in ['RISK_FLAGS', 'TOP_POSITIVE_FACTORS', 'TOP_NEGATIVE_FACTORS', 
                        'FEATURE_CONTRIBUTIONS', 'FEATURE_SNAPSHOT']:
            predictions_df[col_name] = predictions_df[col_name].apply(json.dumps)
        
        # Create Snowpark DataFrame and write
        snow_df = session.create_dataframe(predictions_df)
        
        # Use MERGE to handle potential duplicates
        snow_df.write.mode('append').save_as_table(
            'TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS',
            mode='append'
        )
    
    # -------------------------------------------------------------------------
    # Step 8: Return results
    # -------------------------------------------------------------------------
    prediction_end = datetime.now()
    
    if mode == 'single':
        return {
            'status': 'SUCCESS',
            'mode': 'single',
            'model_version': model_version_used,
            'prediction': results[0],
            'processing_time_ms': int((prediction_end - prediction_start).total_seconds() * 1000)
        }
    else:
        return {
            'status': 'SUCCESS',
            'mode': 'batch',
            'model_version': model_version_used,
            'total_predictions': len(results),
            'predictions_summary': {
                'win_count': sum(1 for r in results if r['prediction_class'] == 'WIN'),
                'lose_count': sum(1 for r in results if r['prediction_class'] == 'LOSE'),
                'uncertain_count': sum(1 for r in results if r['prediction_class'] == 'UNCERTAIN'),
                'avg_win_probability': round(np.mean([r['win_probability'] for r in results]), 4),
                'risk_flag_distribution': compute_risk_distribution(results)
            },
            'sample_predictions': results[:10],  # Return first 10 for preview
            'processing_time_ms': int((prediction_end - prediction_start).total_seconds() * 1000)
        }


def compute_risk_distribution(results: List[dict]) -> dict:
    """Compute distribution of risk flags across predictions."""
    risk_counts = {}
    for result in results:
        for flag in result.get('risk_flags', []):
            risk_counts[flag] = risk_counts.get(flag, 0) + 1
    return risk_counts
$$;

-- Grant execute permission
GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SP_PREDICT_WIN_PROBABILITY(
    VARCHAR, VARCHAR, VARCHAR, INT, BOOLEAN
) TO ROLE TDR_APP_ROLE;


-- ============================================================================
-- HELPER: Procedure to deploy a model to production
-- ============================================================================
CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.SP_DEPLOY_MODEL_TO_PRODUCTION(
    MODEL_VERSION VARCHAR
)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
BEGIN
    -- Set all existing models to non-production
    UPDATE TDR_APP.ML_MODELS.ML_MODEL_METADATA
    SET IS_PRODUCTION = FALSE,
        STATUS = CASE WHEN STATUS = 'DEPLOYED' THEN 'RETIRED' ELSE STATUS END,
        RETIRED_AT = CASE WHEN STATUS = 'DEPLOYED' THEN CURRENT_TIMESTAMP() ELSE RETIRED_AT END
    WHERE MODEL_NAME = 'deal_close_propensity'
      AND IS_PRODUCTION = TRUE;
    
    -- Deploy the specified version
    UPDATE TDR_APP.ML_MODELS.ML_MODEL_METADATA
    SET IS_PRODUCTION = TRUE,
        STATUS = 'DEPLOYED',
        DEPLOYED_AT = CURRENT_TIMESTAMP()
    WHERE MODEL_NAME = 'deal_close_propensity'
      AND MODEL_VERSION = :MODEL_VERSION;
    
    RETURN OBJECT_CONSTRUCT(
        'status', 'SUCCESS',
        'deployed_version', :MODEL_VERSION,
        'deployed_at', CURRENT_TIMESTAMP()
    );
END;
$$;

-- Grant execute permission
GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SP_DEPLOY_MODEL_TO_PRODUCTION(VARCHAR) 
TO ROLE TDR_APP_ROLE;


-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================
/*
-- Example 1: Train a new stacking ensemble model with SMOTE for class imbalance
CALL TDR_APP.ML_MODELS.SP_TRAIN_STACKING_ENSEMBLE(
    'DOMO_DB.DOMO_SCHEMA.OPPORTUNITIESMAGIC',  -- Source table
    NULL,                                       -- Auto-generate version
    'smote',                                    -- Use SMOTE for imbalance
    0.2,                                        -- 20% test split
    42,                                         -- Random state
    'Initial training run with SMOTE'           -- Notes
);

-- Example 2: Train with class weights instead of SMOTE
CALL TDR_APP.ML_MODELS.SP_TRAIN_STACKING_ENSEMBLE(
    'DOMO_DB.DOMO_SCHEMA.OPPORTUNITIESMAGIC',
    'v2024_class_weight',
    'class_weight',
    0.2,
    42,
    'Training with class_weight=balanced'
);

-- Example 3: Predict for a single opportunity with SHAP explanations
CALL TDR_APP.ML_MODELS.SP_PREDICT_WIN_PROBABILITY(
    'single',                    -- Mode
    '0063t00000ABC123',          -- Opportunity ID
    NULL,                        -- Use production model
    NULL,                        -- Not used for single mode
    TRUE                         -- Include SHAP explanations
);

-- Example 4: Batch predict for all opportunities without recent predictions
CALL TDR_APP.ML_MODELS.SP_PREDICT_WIN_PROBABILITY(
    'batch',                     -- Mode
    NULL,                        -- Not used for batch mode
    NULL,                        -- Use production model
    1000,                        -- Batch limit
    TRUE                         -- Include SHAP explanations
);

-- Example 5: Deploy a specific model version to production
CALL TDR_APP.ML_MODELS.SP_DEPLOY_MODEL_TO_PRODUCTION('v20241115_120000');

-- Example 6: View production model
SELECT * FROM TDR_APP.ML_MODELS.V_PRODUCTION_MODEL;

-- Example 7: Check model performance metrics
SELECT 
    MODEL_VERSION,
    AUC_ROC,
    AUC_PR,
    F1_SCORE,
    PRECISION_SCORE,
    RECALL_SCORE,
    BRIER_SCORE,
    CV_SCORES
FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
WHERE MODEL_NAME = 'deal_close_propensity'
ORDER BY TRAINED_AT DESC;

-- Example 8: View latest predictions for an account
SELECT 
    OPPORTUNITY_ID,
    WIN_PROBABILITY,
    PREDICTION_CLASS,
    CONFIDENCE_SCORE,
    RISK_FLAGS,
    TOP_POSITIVE_FACTORS,
    TOP_NEGATIVE_FACTORS
FROM TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS
WHERE ACCOUNT_ID = 'your_account_id'
ORDER BY PREDICTION_DATE DESC;
*/
