-- =============================================================================
-- ML INFRASTRUCTURE DDL FOR DEAL CLOSE PROPENSITY MODEL
-- Target: TDR_APP.ML_MODELS schema
-- =============================================================================

-- 1. CREATE ML_MODELS SCHEMA
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS TDR_APP.ML_MODELS
    COMMENT = 'Schema for ML model objects, feature store, predictions, and training data';

-- Grant usage to application role
GRANT USAGE ON SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;

-- =============================================================================
-- 2. ML_FEATURE_STORE TABLE
-- Pre-computed derived features per opportunity for ML training and inference
-- =============================================================================
CREATE OR REPLACE TABLE TDR_APP.ML_MODELS.ML_FEATURE_STORE (
    -- Primary identifiers
    FEATURE_ID              VARCHAR(36) NOT NULL DEFAULT UUID_STRING(),
    OPPORTUNITY_ID          VARCHAR(50) NOT NULL,
    ACCOUNT_ID              VARCHAR(50),
    
    -- Timestamp for feature versioning (enables time-travel for point-in-time features)
    FEATURE_DATE            DATE NOT NULL DEFAULT CURRENT_DATE(),
    COMPUTED_AT             TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    
    -- Historical Win Rate Features
    ACCOUNT_WIN_RATE        FLOAT COMMENT 'Account historical win rate: Won / (Won + Lost)',
    TYPE_SPECIFIC_WIN_RATE  FLOAT COMMENT 'Win rate for this deal type',
    
    -- Velocity & Timing Features
    STAGE_VELOCITY_RATIO    FLOAT COMMENT 'Stage age vs cohort average (>1 = slower than avg)',
    QUARTER_URGENCY         FLOAT COMMENT 'Proximity to quarter end (0-1, higher = closer)',
    DAYS_IN_CURRENT_STAGE   INTEGER COMMENT 'Days spent in current stage',
    DAYS_SINCE_CREATED      INTEGER COMMENT 'Total deal age in days',
    
    -- Deal Complexity Features
    DEAL_COMPLEXITY_INDEX   FLOAT COMMENT 'Normalized complexity: line items + competitors + services',
    COMPETITOR_COUNT        INTEGER COMMENT 'Number of named competitors',
    LINE_ITEM_COUNT         INTEGER COMMENT 'Number of deal line items',
    
    -- Financial Features
    SERVICES_RATIO          FLOAT COMMENT 'Professional services / total price',
    ACV_NORMALIZED          FLOAT COMMENT 'ACV normalized within segment',
    REVENUE_PER_EMPLOYEE    FLOAT COMMENT 'Deal ACV / account employee count',
    
    -- Process Completeness Features
    SALES_PROCESS_COMPLETENESS FLOAT COMMENT 'Completed milestones / total milestones (0-1)',
    STEPS_COMPLETED         INTEGER COMMENT 'Number of TDR steps completed',
    TOTAL_STEPS             INTEGER COMMENT 'Total available steps in workflow',
    HAS_THESIS              BOOLEAN COMMENT 'Deal thesis has been defined',
    HAS_STAKEHOLDERS        BOOLEAN COMMENT 'Key stakeholders identified',
    
    -- Categorical encodings (for model input)
    STAGE_ORDINAL           INTEGER COMMENT 'Stage encoded as ordinal (1-7)',
    DEAL_COMPLEXITY_ENCODED INTEGER COMMENT 'Complexity category encoded (1=Low, 2=Medium, 3=High)',
    AI_MATURITY_ENCODED     INTEGER COMMENT 'AI maturity encoded (1-5)',
    
    -- Feature metadata
    FEATURE_VERSION         VARCHAR(20) DEFAULT 'v1' COMMENT 'Feature engineering version',
    SOURCE_SESSION_ID       VARCHAR(50) COMMENT 'TDR session used for feature extraction',
    
    -- Constraints
    CONSTRAINT pk_feature_store PRIMARY KEY (FEATURE_ID),
    CONSTRAINT uq_opp_date UNIQUE (OPPORTUNITY_ID, FEATURE_DATE)
)
CLUSTER BY (FEATURE_DATE, OPPORTUNITY_ID)
COMMENT = 'Pre-computed ML features for deal close propensity model';

-- Create search optimization for common queries
-- ALTER TABLE TDR_APP.ML_MODELS.ML_FEATURE_STORE ADD SEARCH OPTIMIZATION ON EQUALITY(OPPORTUNITY_ID, ACCOUNT_ID);


-- =============================================================================
-- 3. DEAL_ML_PREDICTIONS TABLE
-- Batch scoring results and prediction history
-- =============================================================================
CREATE OR REPLACE TABLE TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS (
    -- Primary identifiers
    PREDICTION_ID           VARCHAR(36) NOT NULL DEFAULT UUID_STRING(),
    OPPORTUNITY_ID          VARCHAR(50) NOT NULL,
    
    -- Prediction outputs
    WIN_PROBABILITY         FLOAT NOT NULL COMMENT 'Predicted probability of close (0-1)',
    PREDICTION_CLASS        VARCHAR(20) COMMENT 'Predicted class: WIN, LOSE, UNCERTAIN',
    CONFIDENCE_SCORE        FLOAT COMMENT 'Model confidence in prediction (0-1)',
    
    -- Probability calibration
    CALIBRATED_PROBABILITY  FLOAT COMMENT 'Isotonic/Platt calibrated probability',
    PREDICTION_PERCENTILE   FLOAT COMMENT 'Percentile rank within scoring batch',
    
    -- Risk indicators
    RISK_FLAGS              VARIANT COMMENT 'Array of identified risk factors',
    TOP_POSITIVE_FACTORS    VARIANT COMMENT 'Top 5 features contributing to win',
    TOP_NEGATIVE_FACTORS    VARIANT COMMENT 'Top 5 features contributing to loss',
    
    -- SHAP/Feature importance for explainability
    FEATURE_CONTRIBUTIONS   VARIANT COMMENT 'SHAP values or feature contributions',
    
    -- Model metadata
    MODEL_ID                VARCHAR(36) NOT NULL COMMENT 'FK to ML_MODEL_METADATA',
    MODEL_VERSION           VARCHAR(50) NOT NULL COMMENT 'Model version used for prediction',
    FEATURE_STORE_ID        VARCHAR(36) COMMENT 'FK to ML_FEATURE_STORE snapshot used',
    
    -- Scoring context
    SCORING_BATCH_ID        VARCHAR(36) COMMENT 'Batch identifier for bulk scoring runs',
    SCORED_AT               TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    
    -- Actuals for model monitoring (filled in after outcome known)
    ACTUAL_OUTCOME          VARCHAR(20) COMMENT 'Actual outcome: WON, LOST, OPEN',
    OUTCOME_DATE            DATE COMMENT 'Date outcome was recorded',
    PREDICTION_CORRECT      BOOLEAN COMMENT 'Was prediction correct?',
    
    -- Constraints
    CONSTRAINT pk_predictions PRIMARY KEY (PREDICTION_ID)
)
CLUSTER BY (SCORED_AT, OPPORTUNITY_ID)
COMMENT = 'Batch scoring results for deal close propensity model';

-- Index for monitoring queries
-- ALTER TABLE TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS ADD SEARCH OPTIMIZATION ON EQUALITY(OPPORTUNITY_ID, MODEL_VERSION, SCORING_BATCH_ID);


-- =============================================================================
-- 4. ML_MODEL_METADATA TABLE
-- Training runs, metrics, and model version tracking
-- =============================================================================
CREATE OR REPLACE TABLE TDR_APP.ML_MODELS.ML_MODEL_METADATA (
    -- Primary identifiers
    MODEL_ID                VARCHAR(36) NOT NULL DEFAULT UUID_STRING(),
    MODEL_NAME              VARCHAR(100) NOT NULL DEFAULT 'deal_close_propensity',
    MODEL_VERSION           VARCHAR(50) NOT NULL,
    
    -- Model lifecycle
    STATUS                  VARCHAR(20) NOT NULL DEFAULT 'TRAINING' 
                            COMMENT 'TRAINING, VALIDATED, DEPLOYED, RETIRED, FAILED',
    IS_PRODUCTION           BOOLEAN DEFAULT FALSE COMMENT 'Currently deployed to production',
    
    -- Training configuration
    ALGORITHM               VARCHAR(50) COMMENT 'XGBoost, LightGBM, RandomForest, etc.',
    HYPERPARAMETERS         VARIANT COMMENT 'Model hyperparameters as JSON',
    FEATURE_LIST            VARIANT COMMENT 'List of features used in training',
    FEATURE_VERSION         VARCHAR(20) COMMENT 'Feature engineering version used',
    
    -- Training data details
    TRAINING_START_DATE     DATE COMMENT 'Start of training data window',
    TRAINING_END_DATE       DATE COMMENT 'End of training data window',
    TRAINING_ROW_COUNT      INTEGER COMMENT 'Number of training samples',
    POSITIVE_CLASS_COUNT    INTEGER COMMENT 'Number of WON deals in training',
    NEGATIVE_CLASS_COUNT    INTEGER COMMENT 'Number of LOST deals in training',
    CLASS_WEIGHT_STRATEGY   VARCHAR(50) COMMENT 'balanced, custom, none',
    
    -- Validation metrics
    VALIDATION_METRICS      VARIANT COMMENT 'JSON with all validation metrics',
    AUC_ROC                 FLOAT COMMENT 'Area under ROC curve',
    AUC_PR                  FLOAT COMMENT 'Area under Precision-Recall curve',
    ACCURACY                FLOAT COMMENT 'Overall accuracy',
    PRECISION_SCORE         FLOAT COMMENT 'Precision for WIN class',
    RECALL_SCORE            FLOAT COMMENT 'Recall for WIN class',
    F1_SCORE                FLOAT COMMENT 'F1 score for WIN class',
    LOG_LOSS                FLOAT COMMENT 'Logarithmic loss',
    BRIER_SCORE             FLOAT COMMENT 'Brier score for calibration',
    
    -- Cross-validation details
    CV_STRATEGY             VARCHAR(50) COMMENT 'stratified_kfold, time_series_split, etc.',
    CV_FOLDS                INTEGER COMMENT 'Number of CV folds',
    CV_SCORES               VARIANT COMMENT 'Per-fold scores',
    
    -- Model artifacts
    MODEL_ARTIFACT_PATH     VARCHAR(500) COMMENT 'Stage path to serialized model',
    MODEL_SIZE_BYTES        INTEGER COMMENT 'Size of serialized model',
    
    -- Feature importance
    FEATURE_IMPORTANCE      VARIANT COMMENT 'Feature importance scores',
    TOP_FEATURES            VARIANT COMMENT 'Top 10 most important features',
    
    -- Timestamps and audit
    CREATED_AT              TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    TRAINED_AT              TIMESTAMP_NTZ COMMENT 'Training completion timestamp',
    DEPLOYED_AT             TIMESTAMP_NTZ COMMENT 'Production deployment timestamp',
    RETIRED_AT              TIMESTAMP_NTZ COMMENT 'Retirement timestamp',
    CREATED_BY              VARCHAR(100) COMMENT 'User who initiated training',
    
    -- Notes and documentation
    DESCRIPTION             VARCHAR(2000) COMMENT 'Model description and changelog',
    TRAINING_NOTES          VARCHAR(4000) COMMENT 'Notes from training run',
    
    -- Constraints
    CONSTRAINT pk_model_metadata PRIMARY KEY (MODEL_ID),
    CONSTRAINT uq_model_version UNIQUE (MODEL_NAME, MODEL_VERSION)
)
COMMENT = 'Model registry for deal close propensity models';


-- =============================================================================
-- 5. ML_TRAINING_DATA VIEW
-- Joins opportunity data with derived features and outcome labels
-- =============================================================================
CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.ML_TRAINING_DATA AS
WITH 
-- Get the latest session per opportunity
latest_sessions AS (
    SELECT 
        s.OPPORTUNITY_ID,
        s.SESSION_ID,
        s.OPPORTUNITY_NAME,
        s.ACCOUNT_NAME,
        s.ACV,
        s.STAGE,
        s.STATUS,
        s.OUTCOME,
        s.OWNER,
        s.COMPLETED_STEPS,
        s.CREATED_AT AS SESSION_CREATED_AT,
        s.UPDATED_AT AS SESSION_UPDATED_AT,
        ROW_NUMBER() OVER (PARTITION BY s.OPPORTUNITY_ID ORDER BY s.UPDATED_AT DESC) AS rn
    FROM TDR_APP.TDR_DATA.TDR_SESSIONS s
),

-- Get structured extracts per session
session_extracts AS (
    SELECT 
        e.SESSION_ID,
        e.OPPORTUNITY_ID,
        e.THESIS,
        e.STRATEGIC_VALUE,
        e.DECISION_TIMELINE,
        e.AI_MATURITY,
        e.VERDICT,
        e.DEAL_COMPLEXITY,
        e.NAMED_COMPETITORS,
        e.NAMED_STAKEHOLDERS,
        e.RISK_CATEGORIES,
        ARRAY_SIZE(COALESCE(e.NAMED_COMPETITORS, ARRAY_CONSTRUCT())) AS COMPETITOR_COUNT,
        ARRAY_SIZE(COALESCE(e.NAMED_STAKEHOLDERS, ARRAY_CONSTRUCT())) AS STAKEHOLDER_COUNT,
        ARRAY_SIZE(COALESCE(e.RISK_CATEGORIES, ARRAY_CONSTRUCT())) AS RISK_COUNT
    FROM TDR_APP.TDR_DATA.TDR_STRUCTURED_EXTRACTS e
),

-- Count completed steps per session
step_counts AS (
    SELECT 
        SESSION_ID,
        COUNT(DISTINCT STEP_ID) AS STEPS_COMPLETED,
        COUNT(DISTINCT FIELD_ID) AS FIELDS_COMPLETED
    FROM TDR_APP.TDR_DATA.TDR_STEP_INPUTS
    GROUP BY SESSION_ID
),

-- Get total available steps (from step definitions)
total_steps AS (
    SELECT COUNT(*) AS TOTAL_STEPS_AVAILABLE
    FROM TDR_APP.TDR_DATA.TDR_STEP_DEFINITIONS
),

-- Get account intelligence data
account_intel AS (
    SELECT 
        OPPORTUNITY_ID,
        ACCOUNT_NAME,
        INDUSTRY,
        SUB_INDUSTRY,
        EMPLOYEE_COUNT,
        REVENUE AS ACCOUNT_REVENUE,
        TECHNOLOGIES,
        ROW_NUMBER() OVER (PARTITION BY OPPORTUNITY_ID ORDER BY PULLED_AT DESC) AS rn
    FROM TDR_APP.TDR_DATA.ACCOUNT_INTEL_SUMBLE
)

SELECT
    -- Identifiers
    ls.OPPORTUNITY_ID,
    ls.SESSION_ID,
    ls.OPPORTUNITY_NAME,
    ls.ACCOUNT_NAME,
    
    -- Target variable (outcome label)
    ls.OUTCOME,
    CASE 
        WHEN ls.OUTCOME = 'won' THEN 1
        WHEN ls.OUTCOME = 'lost' THEN 0
        ELSE NULL  -- Exclude open/in-progress for training
    END AS WIN_LABEL,
    
    -- Core opportunity features
    ls.ACV,
    ls.STAGE,
    ls.STATUS,
    ls.OWNER,
    ls.SESSION_CREATED_AT,
    ls.SESSION_UPDATED_AT,
    
    -- Stage encoding
    CASE ls.STAGE
        WHEN '1: Connect' THEN 1
        WHEN '2: Determine Needs' THEN 2
        WHEN '3: Demonstrate Value' THEN 3
        WHEN '4: Validate Value' THEN 4
        WHEN '5: Negotiate' THEN 5
        WHEN '6: Close' THEN 6
        WHEN '7: Won' THEN 7
        ELSE 0
    END AS STAGE_ORDINAL,
    
    -- Extract features
    se.THESIS,
    se.STRATEGIC_VALUE,
    se.DECISION_TIMELINE,
    se.AI_MATURITY,
    se.VERDICT,
    se.DEAL_COMPLEXITY,
    se.COMPETITOR_COUNT,
    se.STAKEHOLDER_COUNT,
    se.RISK_COUNT,
    se.NAMED_COMPETITORS,
    se.NAMED_STAKEHOLDERS,
    se.RISK_CATEGORIES,
    
    -- Deal complexity encoding
    CASE se.DEAL_COMPLEXITY
        WHEN 'Low' THEN 1
        WHEN 'Medium' THEN 2
        WHEN 'High' THEN 3
        ELSE 2  -- Default to medium
    END AS DEAL_COMPLEXITY_ENCODED,
    
    -- AI maturity encoding
    CASE se.AI_MATURITY
        WHEN 'Nascent' THEN 1
        WHEN 'Emerging' THEN 2
        WHEN 'Developing' THEN 3
        WHEN 'Mature' THEN 4
        WHEN 'Advanced' THEN 5
        ELSE 3  -- Default to developing
    END AS AI_MATURITY_ENCODED,
    
    -- Process completeness
    COALESCE(sc.STEPS_COMPLETED, 0) AS STEPS_COMPLETED,
    COALESCE(sc.FIELDS_COMPLETED, 0) AS FIELDS_COMPLETED,
    ts.TOTAL_STEPS_AVAILABLE,
    COALESCE(sc.STEPS_COMPLETED, 0)::FLOAT / NULLIF(ts.TOTAL_STEPS_AVAILABLE, 0) 
        AS SALES_PROCESS_COMPLETENESS,
    
    -- Boolean flags for key milestones
    se.THESIS IS NOT NULL AS HAS_THESIS,
    ARRAY_SIZE(COALESCE(se.NAMED_STAKEHOLDERS, ARRAY_CONSTRUCT())) > 0 AS HAS_STAKEHOLDERS,
    se.VERDICT IS NOT NULL AS HAS_VERDICT,
    
    -- Account features
    ai.INDUSTRY,
    ai.SUB_INDUSTRY,
    ai.EMPLOYEE_COUNT,
    ai.ACCOUNT_REVENUE,
    
    -- Revenue per employee
    CASE 
        WHEN ai.EMPLOYEE_COUNT > 0 THEN ls.ACV / ai.EMPLOYEE_COUNT
        ELSE NULL
    END AS REVENUE_PER_EMPLOYEE,
    
    -- Time-based features
    DATEDIFF('day', ls.SESSION_CREATED_AT, ls.SESSION_UPDATED_AT) AS DAYS_IN_PROCESS,
    DATEDIFF('day', ls.SESSION_CREATED_AT, CURRENT_TIMESTAMP()) AS DAYS_SINCE_CREATED,
    
    -- Quarter urgency (proximity to quarter end)
    CASE 
        WHEN MONTH(CURRENT_DATE()) IN (3, 6, 9, 12) THEN
            1 - (DAY(LAST_DAY(CURRENT_DATE())) - DAY(CURRENT_DATE()))::FLOAT / 30
        WHEN MONTH(CURRENT_DATE()) IN (2, 5, 8, 11) THEN
            (30 - DAY(CURRENT_DATE()) + DAY(LAST_DAY(ADD_MONTHS(CURRENT_DATE(), 1))))::FLOAT / 60
        ELSE
            0.3  -- Early in quarter
    END AS QUARTER_URGENCY,
    
    -- Completed steps array (for analysis)
    ls.COMPLETED_STEPS,
    ARRAY_SIZE(COALESCE(ls.COMPLETED_STEPS, ARRAY_CONSTRUCT())) AS COMPLETED_STEPS_COUNT,
    
    -- Metadata
    CURRENT_TIMESTAMP() AS VIEW_GENERATED_AT

FROM latest_sessions ls
LEFT JOIN session_extracts se ON ls.SESSION_ID = se.SESSION_ID
LEFT JOIN step_counts sc ON ls.SESSION_ID = sc.SESSION_ID
LEFT JOIN account_intel ai ON ls.OPPORTUNITY_ID = ai.OPPORTUNITY_ID AND ai.rn = 1
CROSS JOIN total_steps ts
WHERE ls.rn = 1;


-- =============================================================================
-- 6. SUPPORTING VIEWS FOR ML OPERATIONS
-- =============================================================================

-- View for model monitoring: Compare predictions to actuals
CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.V_MODEL_PERFORMANCE AS
SELECT 
    p.MODEL_VERSION,
    p.SCORING_BATCH_ID,
    DATE_TRUNC('week', p.SCORED_AT) AS SCORE_WEEK,
    COUNT(*) AS PREDICTION_COUNT,
    SUM(CASE WHEN p.ACTUAL_OUTCOME IS NOT NULL THEN 1 ELSE 0 END) AS OUTCOMES_KNOWN,
    SUM(CASE WHEN p.PREDICTION_CORRECT = TRUE THEN 1 ELSE 0 END) AS CORRECT_PREDICTIONS,
    AVG(p.WIN_PROBABILITY) AS AVG_WIN_PROBABILITY,
    AVG(CASE WHEN p.ACTUAL_OUTCOME = 'WON' THEN p.WIN_PROBABILITY END) AS AVG_PROB_FOR_WINS,
    AVG(CASE WHEN p.ACTUAL_OUTCOME = 'LOST' THEN p.WIN_PROBABILITY END) AS AVG_PROB_FOR_LOSSES
FROM TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS p
GROUP BY p.MODEL_VERSION, p.SCORING_BATCH_ID, DATE_TRUNC('week', p.SCORED_AT);


-- View for latest features per opportunity
CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.V_LATEST_FEATURES AS
SELECT *
FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE
QUALIFY ROW_NUMBER() OVER (PARTITION BY OPPORTUNITY_ID ORDER BY FEATURE_DATE DESC) = 1;


-- View for latest predictions per opportunity
CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.V_LATEST_PREDICTIONS AS
SELECT *
FROM TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS
QUALIFY ROW_NUMBER() OVER (PARTITION BY OPPORTUNITY_ID ORDER BY SCORED_AT DESC) = 1;


-- View for production model
CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.V_PRODUCTION_MODEL AS
SELECT *
FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
WHERE IS_PRODUCTION = TRUE
QUALIFY ROW_NUMBER() OVER (ORDER BY DEPLOYED_AT DESC) = 1;


-- =============================================================================
-- 7. GRANTS (Adjust roles as needed)
-- =============================================================================

-- Grant table permissions to application role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE TDR_APP.ML_MODELS.ML_FEATURE_STORE TO ROLE TDR_APP_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS TO ROLE TDR_APP_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE TDR_APP.ML_MODELS.ML_MODEL_METADATA TO ROLE TDR_APP_ROLE;

-- Grant view permissions
GRANT SELECT ON VIEW TDR_APP.ML_MODELS.ML_TRAINING_DATA TO ROLE TDR_APP_ROLE;
GRANT SELECT ON VIEW TDR_APP.ML_MODELS.V_MODEL_PERFORMANCE TO ROLE TDR_APP_ROLE;
GRANT SELECT ON VIEW TDR_APP.ML_MODELS.V_LATEST_FEATURES TO ROLE TDR_APP_ROLE;
GRANT SELECT ON VIEW TDR_APP.ML_MODELS.V_LATEST_PREDICTIONS TO ROLE TDR_APP_ROLE;
GRANT SELECT ON VIEW TDR_APP.ML_MODELS.V_PRODUCTION_MODEL TO ROLE TDR_APP_ROLE;


-- =============================================================================
-- 8. OPTIONAL: CREATE INTERNAL STAGE FOR MODEL ARTIFACTS
-- =============================================================================
CREATE OR REPLACE STAGE TDR_APP.ML_MODELS.MODEL_ARTIFACTS
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Stage for storing serialized ML models';

GRANT READ, WRITE ON STAGE TDR_APP.ML_MODELS.MODEL_ARTIFACTS TO ROLE TDR_APP_ROLE;
