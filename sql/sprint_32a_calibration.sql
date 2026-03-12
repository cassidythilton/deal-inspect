-- =============================================================================
-- SPRINT 32a: MODEL CALIBRATION & RETRAIN
-- =============================================================================
-- Fixes bimodal, overconfident score distribution by:
--   1. Adding 3-year recency filter to training data (reduce covariate shift)
--   2. Capping DAYS_IN_PIPELINE at 730 in training + scoring views
--   3. Adding score capping [3%, 97%] to scoring procedure
--   4. Creating PREDICTION_SNAPSHOTS table for ground truth tracking
--   5. Updating scoring procedure to snapshot before overwrite
--   6. Updating retrain procedure to persist eval metrics + feature importance
--
-- Run order:
--   1. ML_TRAINING_DATA_CLEAN view (Section 1)
--   2. ML_PIPELINE_FEATURES view update (Section 2)
--   3. PREDICTION_SNAPSHOTS table (Section 3)
--   4. SCORE_PIPELINE_DEALS procedure update (Section 4)
--   5. RETRAIN_PROPENSITY_MODEL procedure update (Section 5)
--   6. Backfill current model metrics (Section 6)
--   7. Retrain model on calibrated data (Section 7)
--   8. Re-score pipeline (Section 8)
--   9. Verify distribution (Section 9)
--
-- Predecessor: sql/sprint_28c_ml_pipeline.sql
-- =============================================================================

USE DATABASE TDR_APP;
USE SCHEMA ML_MODELS;
USE WAREHOUSE TDR_APP_WH;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 1: ML_TRAINING_DATA_CLEAN VIEW
-- ═══════════════════════════════════════════════════════════════════════
-- Wraps ML_TRAINING_DATA with two calibration filters:
--   (a) 3-year recency filter — excludes deals closed before 3 years ago
--       to reduce distributional mismatch between training and scoring
--   (b) DAYS_IN_PIPELINE capped at 730 — beyond 2 years, additional
--       pipeline time is noise, not signal (and it's the #1 feature at
--       14.6% importance, so uncapped drift is catastrophic)
--
-- This view is the new training input for DEAL_CLOSE_PROPENSITY.
-- The uncapped ML_TRAINING_DATA view is preserved for historical analysis.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.ML_TRAINING_DATA_CLEAN AS
SELECT
    t.OPPORTUNITY_ID,
    t.IS_WON_LABEL,
    t.ACV_USD, t.ACV_LOG, t.ACV_RECURRING, t.ACV_NON_RECURRING,
    t.TCV_USD, t.PLATFORM_PRICE, t.PROF_SERVICES_PRICE, t.LINE_ITEMS,
    t.DEAL_TYPE, t.DEAL_CODE, t.CONTRACT_TYPE, t.PRICING_TYPE,
    t.CPQ, t.NON_COMPETITIVE_DEAL, t.NUM_COMPETITORS,
    t.ACCOUNT_REVENUE_LOG, t.ACCOUNT_EMPLOYEES_LOG, t.STRATEGIC_ACCOUNT,
    t.REGION, t.SALES_SEGMENT, t.SALES_VERTICAL,
    t.ENGAGEMENT_LEVEL_BUCKETED, t.PARTNER_INFLUENCE, t.IS_PARTNER,
    t.LEAD_SOURCE_BUCKETED,
    t.SERVICES_RATIO, t.RECURRING_RATIO, t.ACV_NORMALIZED,
    t.REVENUE_PER_EMPLOYEE, t.SALES_PROCESS_COMPLETENESS,
    LEAST(t.DAYS_IN_PIPELINE, 730) AS DAYS_IN_PIPELINE,
    t.DEAL_COMPLEXITY_INDEX
FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA t
INNER JOIN TDR_APP.PUBLIC."Forecast_Page_Opportunities_Magic_SNFv2" o
    ON t.OPPORTUNITY_ID = o."Opportunity Id"
WHERE o."Close Date" >= DATEADD('year', -3, CURRENT_DATE());


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 2: ML_PIPELINE_FEATURES VIEW (updated — cap DAYS_IN_PIPELINE)
-- ═══════════════════════════════════════════════════════════════════════
-- Same as before but caps DAYS_IN_PIPELINE at 730 to match training.
-- Without this, scoring features diverge from training features and the
-- model sees out-of-distribution values for its most important feature.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.ML_PIPELINE_FEATURES AS
SELECT
    OPPORTUNITY_ID,
    ACV_USD, ACV_LOG, ACV_RECURRING, ACV_NON_RECURRING,
    TCV_USD, PLATFORM_PRICE, PROF_SERVICES_PRICE, LINE_ITEMS,
    DEAL_TYPE, DEAL_CODE, CONTRACT_TYPE, PRICING_TYPE,
    CPQ, NON_COMPETITIVE_DEAL, NUM_COMPETITORS,
    ACCOUNT_REVENUE_LOG, ACCOUNT_EMPLOYEES_LOG, STRATEGIC_ACCOUNT,
    REGION, SALES_SEGMENT, SALES_VERTICAL,
    ENGAGEMENT_LEVEL_BUCKETED, PARTNER_INFLUENCE, IS_PARTNER,
    LEAD_SOURCE_BUCKETED,
    SERVICES_RATIO, RECURRING_RATIO, ACV_NORMALIZED,
    REVENUE_PER_EMPLOYEE, SALES_PROCESS_COMPLETENESS,
    LEAST(DAYS_IN_PIPELINE, 730) AS DAYS_IN_PIPELINE,
    DEAL_COMPLEXITY_INDEX
FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE
WHERE IS_CLOSED IS NULL
   OR IS_CLOSED != 'true';


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 3: PREDICTION_SNAPSHOTS TABLE
-- ═══════════════════════════════════════════════════════════════════════
-- Captures pre-overwrite predictions before each scoring run.
-- When deals eventually close, we can compare snapshot predictions
-- against actual outcomes for calibration and accuracy measurement.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS TDR_APP.ML_MODELS.PREDICTION_SNAPSHOTS (
    SNAPSHOT_ID             VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    OPPORTUNITY_ID          VARCHAR NOT NULL,
    PROPENSITY_SCORE        FLOAT,
    PREDICTION              VARCHAR(10),
    QUADRANT                VARCHAR(20),
    FACTOR_1_NAME           VARCHAR(100),
    FACTOR_1_DIRECTION      VARCHAR(10),
    FACTOR_2_NAME           VARCHAR(100),
    FACTOR_2_DIRECTION      VARCHAR(10),
    FACTOR_3_NAME           VARCHAR(100),
    FACTOR_3_DIRECTION      VARCHAR(10),
    MODEL_VERSION           VARCHAR(50),
    SCORED_AT               TIMESTAMP_NTZ,
    SNAPSHOT_TAKEN_AT       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    SNAPSHOT_REASON         VARCHAR(50) DEFAULT 'PRE_RESCORE'
)
COMMENT = 'Historical prediction snapshots for ground truth tracking and calibration';

GRANT SELECT, INSERT ON TABLE TDR_APP.ML_MODELS.PREDICTION_SNAPSHOTS TO ROLE TDR_APP_ROLE;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 4: SCORE_PIPELINE_DEALS PROCEDURE (updated)
-- ═══════════════════════════════════════════════════════════════════════
-- Changes from Sprint 28c version:
--   (a) Snapshots existing predictions to PREDICTION_SNAPSHOTS before
--       truncating DEAL_PREDICTIONS
--   (b) Applies score capping: GREATEST(0.03, LEAST(0.97, score))
--       to eliminate false certainty at distribution tails
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.SCORE_PIPELINE_DEALS()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    scored_count INTEGER DEFAULT 0;
    snapshot_count INTEGER DEFAULT 0;
    model_version VARCHAR DEFAULT 'v3_calibrated';
BEGIN

    -- Step 0: Snapshot existing predictions before overwriting
    INSERT INTO TDR_APP.ML_MODELS.PREDICTION_SNAPSHOTS (
        OPPORTUNITY_ID, PROPENSITY_SCORE, PREDICTION, QUADRANT,
        FACTOR_1_NAME, FACTOR_1_DIRECTION,
        FACTOR_2_NAME, FACTOR_2_DIRECTION,
        FACTOR_3_NAME, FACTOR_3_DIRECTION,
        MODEL_VERSION, SCORED_AT, SNAPSHOT_REASON
    )
    SELECT
        OPPORTUNITY_ID, PROPENSITY_SCORE, PREDICTION, QUADRANT,
        FACTOR_1_NAME, FACTOR_1_DIRECTION,
        FACTOR_2_NAME, FACTOR_2_DIRECTION,
        FACTOR_3_NAME, FACTOR_3_DIRECTION,
        MODEL_VERSION, SCORED_AT, 'PRE_RESCORE'
    FROM TDR_APP.ML_MODELS.DEAL_PREDICTIONS
    WHERE PROPENSITY_SCORE IS NOT NULL;

    SELECT COUNT(*) INTO :snapshot_count
    FROM TDR_APP.ML_MODELS.DEAL_PREDICTIONS
    WHERE PROPENSITY_SCORE IS NOT NULL;

    -- Step 1: Score all open pipeline deals (capped feature set)
    CREATE OR REPLACE TEMPORARY TABLE _scored_deals AS
    SELECT
        f.OPPORTUNITY_ID,
        TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!PREDICT(
            OBJECT_CONSTRUCT(
                'ACV_USD', f.ACV_USD,
                'ACV_LOG', f.ACV_LOG,
                'ACV_RECURRING', f.ACV_RECURRING,
                'ACV_NON_RECURRING', f.ACV_NON_RECURRING,
                'TCV_USD', f.TCV_USD,
                'PLATFORM_PRICE', f.PLATFORM_PRICE,
                'PROF_SERVICES_PRICE', f.PROF_SERVICES_PRICE,
                'LINE_ITEMS', f.LINE_ITEMS,
                'DEAL_TYPE', f.DEAL_TYPE,
                'DEAL_CODE', f.DEAL_CODE,
                'CONTRACT_TYPE', f.CONTRACT_TYPE,
                'PRICING_TYPE', f.PRICING_TYPE,
                'CPQ', f.CPQ,
                'NON_COMPETITIVE_DEAL', f.NON_COMPETITIVE_DEAL,
                'NUM_COMPETITORS', f.NUM_COMPETITORS,
                'ACCOUNT_REVENUE_LOG', f.ACCOUNT_REVENUE_LOG,
                'ACCOUNT_EMPLOYEES_LOG', f.ACCOUNT_EMPLOYEES_LOG,
                'STRATEGIC_ACCOUNT', f.STRATEGIC_ACCOUNT,
                'REGION', f.REGION,
                'SALES_SEGMENT', f.SALES_SEGMENT,
                'SALES_VERTICAL', f.SALES_VERTICAL,
                'ENGAGEMENT_LEVEL_BUCKETED', f.ENGAGEMENT_LEVEL_BUCKETED,
                'PARTNER_INFLUENCE', f.PARTNER_INFLUENCE,
                'IS_PARTNER', f.IS_PARTNER,
                'LEAD_SOURCE_BUCKETED', f.LEAD_SOURCE_BUCKETED,
                'SERVICES_RATIO', f.SERVICES_RATIO,
                'RECURRING_RATIO', f.RECURRING_RATIO,
                'ACV_NORMALIZED', f.ACV_NORMALIZED,
                'REVENUE_PER_EMPLOYEE', f.REVENUE_PER_EMPLOYEE,
                'SALES_PROCESS_COMPLETENESS', f.SALES_PROCESS_COMPLETENESS,
                'DAYS_IN_PIPELINE', f.DAYS_IN_PIPELINE,
                'DEAL_COMPLEXITY_INDEX', f.DEAL_COMPLEXITY_INDEX
            )
        ) AS PRED,
        f.SERVICES_RATIO,
        f.RECURRING_RATIO,
        f.ACV_NORMALIZED,
        f.SALES_PROCESS_COMPLETENESS,
        f.DAYS_IN_PIPELINE,
        f.DEAL_COMPLEXITY_INDEX,
        f.REVENUE_PER_EMPLOYEE,
        f.ENGAGEMENT_LEVEL_BUCKETED,
        f.ACV_LOG,
        f.NUM_COMPETITORS,
        f.PARTNER_INFLUENCE,
        f.LEAD_SOURCE_BUCKETED
    FROM TDR_APP.ML_MODELS.ML_PIPELINE_FEATURES f;

    -- Step 2: Compute population baselines for factor context
    CREATE OR REPLACE TEMPORARY TABLE _baselines AS
    SELECT
        AVG(SERVICES_RATIO) AS avg_services_ratio,
        AVG(RECURRING_RATIO) AS avg_recurring_ratio,
        AVG(SALES_PROCESS_COMPLETENESS) AS avg_process,
        AVG(DAYS_IN_PIPELINE) AS avg_days_pipeline,
        AVG(DEAL_COMPLEXITY_INDEX) AS avg_complexity,
        AVG(REVENUE_PER_EMPLOYEE) AS avg_rev_per_emp,
        AVG(ACV_LOG) AS avg_acv_log,
        AVG(NUM_COMPETITORS) AS avg_competitors
    FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE
    WHERE IS_CLOSED = 'true';

    -- Step 3: Build predictions with factor explanations + score capping
    CREATE OR REPLACE TEMPORARY TABLE _predictions_with_factors AS
    WITH scored AS (
        SELECT
            s.OPPORTUNITY_ID,
            -- Score capping: clamp to [3%, 97%] to eliminate false certainty
            GREATEST(0.03, LEAST(0.97,
                ROUND(s.PRED:"probability"::OBJECT:"1"::FLOAT, 4)
            )) AS PROPENSITY_SCORE,
            s.PRED:"class"::VARCHAR AS PREDICTION,
            b.*,
            s.SERVICES_RATIO,
            s.RECURRING_RATIO,
            s.ACV_NORMALIZED,
            s.SALES_PROCESS_COMPLETENESS,
            s.DAYS_IN_PIPELINE,
            s.DEAL_COMPLEXITY_INDEX,
            s.REVENUE_PER_EMPLOYEE,
            s.ENGAGEMENT_LEVEL_BUCKETED,
            s.ACV_LOG,
            s.NUM_COMPETITORS,
            s.PARTNER_INFLUENCE,
            s.LEAD_SOURCE_BUCKETED
        FROM _scored_deals s
        CROSS JOIN _baselines b
    ),
    factor_ranked AS (
        SELECT
            OPPORTUNITY_ID,
            PROPENSITY_SCORE,
            PREDICTION,
            ARRAY_CONSTRUCT(
                OBJECT_CONSTRUCT('name', 'Sales Process',
                    'value', ROUND(COALESCE(SALES_PROCESS_COMPLETENESS, 0) * 100)::VARCHAR || '%',
                    'direction', CASE WHEN COALESCE(SALES_PROCESS_COMPLETENESS, 0) > 0.6 THEN 'helps' WHEN COALESCE(SALES_PROCESS_COMPLETENESS, 0) < 0.3 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(SALES_PROCESS_COMPLETENESS, 0) - COALESCE(avg_process, 0.4))),
                OBJECT_CONSTRUCT('name', 'Deal Size',
                    'value', CASE WHEN ACV_NORMALIZED > 1 THEN 'Above Avg' WHEN ACV_NORMALIZED < -1 THEN 'Below Avg' ELSE 'Average' END,
                    'direction', CASE WHEN ACV_NORMALIZED > 0.5 THEN 'helps' WHEN ACV_NORMALIZED < -0.5 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(ACV_NORMALIZED, 0))),
                OBJECT_CONSTRUCT('name', 'Competition',
                    'value', COALESCE(NUM_COMPETITORS, 0)::VARCHAR || ' competitors',
                    'direction', CASE WHEN COALESCE(NUM_COMPETITORS, 0) = 0 THEN 'helps' WHEN COALESCE(NUM_COMPETITORS, 0) >= 3 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', COALESCE(NUM_COMPETITORS, 0)::FLOAT / GREATEST(COALESCE(avg_competitors, 1), 1)),
                OBJECT_CONSTRUCT('name', 'Engagement Level',
                    'value', COALESCE(ENGAGEMENT_LEVEL_BUCKETED, 'Unknown'),
                    'direction', CASE WHEN ENGAGEMENT_LEVEL_BUCKETED IN ('High', 'Very High') THEN 'helps' WHEN ENGAGEMENT_LEVEL_BUCKETED IN ('None', 'Low', 'Unknown') THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', CASE WHEN ENGAGEMENT_LEVEL_BUCKETED IN ('Very High') THEN 1.0 WHEN ENGAGEMENT_LEVEL_BUCKETED = 'High' THEN 0.7 WHEN ENGAGEMENT_LEVEL_BUCKETED = 'Medium' THEN 0.4 WHEN ENGAGEMENT_LEVEL_BUCKETED = 'Low' THEN 0.2 ELSE 0.1 END),
                OBJECT_CONSTRUCT('name', 'Deal Complexity',
                    'value', ROUND(COALESCE(DEAL_COMPLEXITY_INDEX, 0), 1)::VARCHAR,
                    'direction', CASE WHEN COALESCE(DEAL_COMPLEXITY_INDEX, 0) < COALESCE(avg_complexity, 1) THEN 'helps' WHEN COALESCE(DEAL_COMPLEXITY_INDEX, 0) > COALESCE(avg_complexity, 1) * 2 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(DEAL_COMPLEXITY_INDEX, 0) - COALESCE(avg_complexity, 1))),
                OBJECT_CONSTRUCT('name', 'Deal Age',
                    'value', COALESCE(DAYS_IN_PIPELINE, 0)::VARCHAR || ' days',
                    'direction', CASE WHEN COALESCE(DAYS_IN_PIPELINE, 0) < COALESCE(avg_days_pipeline, 90) THEN 'helps' WHEN COALESCE(DAYS_IN_PIPELINE, 0) > COALESCE(avg_days_pipeline, 90) * 1.5 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(DAYS_IN_PIPELINE, 0) - COALESCE(avg_days_pipeline, 90))::FLOAT / GREATEST(COALESCE(avg_days_pipeline, 90), 1)),
                OBJECT_CONSTRUCT('name', 'Services Mix',
                    'value', ROUND(COALESCE(SERVICES_RATIO, 0) * 100)::VARCHAR || '%',
                    'direction', CASE WHEN COALESCE(SERVICES_RATIO, 0) > COALESCE(avg_services_ratio, 0.2) * 1.5 THEN 'hurts' WHEN COALESCE(SERVICES_RATIO, 0) < COALESCE(avg_services_ratio, 0.2) * 0.5 THEN 'helps' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(SERVICES_RATIO, 0) - COALESCE(avg_services_ratio, 0.2))),
                OBJECT_CONSTRUCT('name', 'Revenue Mix',
                    'value', ROUND(COALESCE(RECURRING_RATIO, 0) * 100)::VARCHAR || '% recurring',
                    'direction', CASE WHEN COALESCE(RECURRING_RATIO, 0) > COALESCE(avg_recurring_ratio, 0.5) THEN 'helps' WHEN COALESCE(RECURRING_RATIO, 0) < COALESCE(avg_recurring_ratio, 0.5) * 0.5 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(RECURRING_RATIO, 0) - COALESCE(avg_recurring_ratio, 0.5)))
            ) AS all_factors
        FROM scored
    ),
    top_factors AS (
        SELECT
            OPPORTUNITY_ID,
            PROPENSITY_SCORE,
            PREDICTION,
            all_factors,
            all_factors[0] AS f1_raw,
            all_factors[1] AS f2_raw,
            all_factors[2] AS f3_raw,
            all_factors[3] AS f4_raw,
            all_factors[4] AS f5_raw
        FROM factor_ranked
    )
    SELECT
        OPPORTUNITY_ID,
        PROPENSITY_SCORE,
        CASE WHEN PREDICTION = '1' THEN 'Won' ELSE 'Lost' END AS PREDICTION,
        CASE
            WHEN PROPENSITY_SCORE >= 0.5 THEN 'HIGH'
            WHEN PROPENSITY_SCORE >= 0.3 THEN 'MONITOR'
            ELSE 'AT_RISK'
        END AS QUADRANT,
        f1_raw:"name"::VARCHAR AS FACTOR_1_NAME,
        f1_raw:"value"::VARCHAR AS FACTOR_1_VALUE,
        f1_raw:"direction"::VARCHAR AS FACTOR_1_DIRECTION,
        f1_raw:"magnitude"::FLOAT AS FACTOR_1_MAGNITUDE,
        f2_raw:"name"::VARCHAR AS FACTOR_2_NAME,
        f2_raw:"value"::VARCHAR AS FACTOR_2_VALUE,
        f2_raw:"direction"::VARCHAR AS FACTOR_2_DIRECTION,
        f2_raw:"magnitude"::FLOAT AS FACTOR_2_MAGNITUDE,
        f3_raw:"name"::VARCHAR AS FACTOR_3_NAME,
        f3_raw:"value"::VARCHAR AS FACTOR_3_VALUE,
        f3_raw:"direction"::VARCHAR AS FACTOR_3_DIRECTION,
        f3_raw:"magnitude"::FLOAT AS FACTOR_3_MAGNITUDE,
        f4_raw:"name"::VARCHAR AS FACTOR_4_NAME,
        f4_raw:"value"::VARCHAR AS FACTOR_4_VALUE,
        f4_raw:"direction"::VARCHAR AS FACTOR_4_DIRECTION,
        f4_raw:"magnitude"::FLOAT AS FACTOR_4_MAGNITUDE,
        f5_raw:"name"::VARCHAR AS FACTOR_5_NAME,
        f5_raw:"value"::VARCHAR AS FACTOR_5_VALUE,
        f5_raw:"direction"::VARCHAR AS FACTOR_5_DIRECTION,
        f5_raw:"magnitude"::FLOAT AS FACTOR_5_MAGNITUDE,
        CURRENT_TIMESTAMP() AS SCORED_AT,
        :model_version AS MODEL_VERSION
    FROM top_factors;

    -- Step 4: Merge into DEAL_PREDICTIONS (truncate + reload)
    TRUNCATE TABLE TDR_APP.ML_MODELS.DEAL_PREDICTIONS;

    INSERT INTO TDR_APP.ML_MODELS.DEAL_PREDICTIONS
    SELECT * FROM _predictions_with_factors;

    SELECT COUNT(*) INTO :scored_count FROM _predictions_with_factors;

    -- Cleanup
    DROP TABLE IF EXISTS _scored_deals;
    DROP TABLE IF EXISTS _baselines;
    DROP TABLE IF EXISTS _predictions_with_factors;

    RETURN 'Scored ' || :scored_count || ' pipeline deals (model ' || :model_version || '). Snapshotted ' || :snapshot_count || ' previous predictions.';
END;
$$;

GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SCORE_PIPELINE_DEALS() TO ROLE TDR_APP_ROLE;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 5: RETRAIN_PROPENSITY_MODEL PROCEDURE (updated)
-- ═══════════════════════════════════════════════════════════════════════
-- Changes from Sprint 28c version:
--   (a) Trains against ML_TRAINING_DATA_CLEAN (recency-filtered + capped)
--   (b) After training, calls SHOW_EVALUATION_METRICS() and
--       SHOW_FEATURE_IMPORTANCE() and persists results to
--       ML_MODEL_METADATA.EVALUATION_METRICS and FEATURE_IMPORTANCE
--   (c) Populates scalar metric columns (F1, Precision, Recall) and
--       class counts from the evaluation output
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.RETRAIN_PROPENSITY_MODEL()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    training_count INTEGER;
    positive_count INTEGER;
    negative_count INTEGER;
    model_version VARCHAR;
BEGIN
    SELECT COUNT(*) INTO :training_count
    FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA_CLEAN;

    SELECT
        SUM(CASE WHEN IS_WON_LABEL = 1 THEN 1 ELSE 0 END),
        SUM(CASE WHEN IS_WON_LABEL = 0 THEN 1 ELSE 0 END)
    INTO :positive_count, :negative_count
    FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA_CLEAN;

    model_version := 'v' || TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYYMMDD_HH24MISS');

    IF (:training_count < 500) THEN
        RETURN 'SKIPPED: Only ' || :training_count || ' training rows (need >= 500)';
    END IF;

    -- Retrain using recency-filtered, capped training data
    CREATE OR REPLACE SNOWFLAKE.ML.CLASSIFICATION TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY(
        INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'TDR_APP.ML_MODELS.ML_TRAINING_DATA_CLEAN'),
        TARGET_COLNAME => 'IS_WON_LABEL',
        CONFIG_OBJECT => {'ON_ERROR': 'SKIP'}
    );

    -- Capture metrics into temp tables (TABLE() in subqueries can fail)
    CREATE OR REPLACE TEMPORARY TABLE _eval_metrics AS
    SELECT * FROM TABLE(TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_EVALUATION_METRICS());

    CREATE OR REPLACE TEMPORARY TABLE _feat_importance AS
    SELECT * FROM TABLE(TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_FEATURE_IMPORTANCE());

    -- Log metadata with full metrics and feature importance
    INSERT INTO TDR_APP.ML_MODELS.ML_MODEL_METADATA (
        MODEL_VERSION, STATUS, IS_PRODUCTION,
        TRAINING_ROW_COUNT, POSITIVE_CLASS_COUNT, NEGATIVE_CLASS_COUNT,
        EVALUATION_METRICS, FEATURE_IMPORTANCE,
        TRAINED_AT, NOTES
    )
    SELECT
        :model_version, 'VALIDATED', TRUE,
        :training_count, :positive_count, :negative_count,
        (SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM _eval_metrics),
        (SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*)) FROM _feat_importance),
        CURRENT_TIMESTAMP(),
        'Auto-retrained — recency-filtered (3yr), DAYS_IN_PIPELINE capped at 730, score capping [3%,97%]';

    -- Mark previous versions as not production
    UPDATE TDR_APP.ML_MODELS.ML_MODEL_METADATA
    SET IS_PRODUCTION = FALSE
    WHERE MODEL_VERSION != :model_version
      AND IS_PRODUCTION = TRUE;

    DROP TABLE IF EXISTS _eval_metrics;
    DROP TABLE IF EXISTS _feat_importance;

    RETURN 'Retrained model ' || :model_version || ' on ' || :training_count ||
           ' rows (' || :positive_count || ' Won / ' || :negative_count || ' Lost)';
END;
$$;

GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.RETRAIN_PROPENSITY_MODEL() TO ROLE TDR_APP_ROLE;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 6: BACKFILL CURRENT MODEL METRICS
-- ═══════════════════════════════════════════════════════════════════════
-- The current production model (v2_leakage_clean) has no metrics stored
-- in ML_MODEL_METADATA. Backfill by running SHOW_EVALUATION_METRICS()
-- and SHOW_FEATURE_IMPORTANCE() against the current model.
--
-- NOTE: Run this BEFORE retraining so the v2 model's metrics are
-- captured. After retraining, DEAL_CLOSE_PROPENSITY is replaced.
-- ═══════════════════════════════════════════════════════════════════════

-- First, check if v2 metrics are already backfilled
-- SELECT MODEL_VERSION, EVALUATION_METRICS, FEATURE_IMPORTANCE
-- FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
-- WHERE MODEL_VERSION = 'v2_leakage_clean';

-- Backfill v2 metrics (run interactively before retraining):
-- UPDATE TDR_APP.ML_MODELS.ML_MODEL_METADATA
-- SET
--     EVALUATION_METRICS = (
--         SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
--         FROM TABLE(TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_EVALUATION_METRICS())
--     ),
--     FEATURE_IMPORTANCE = (
--         SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
--         FROM TABLE(TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_FEATURE_IMPORTANCE())
--     )
-- WHERE MODEL_VERSION = 'v2_leakage_clean';


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 7: RETRAIN MODEL ON CALIBRATED DATA
-- ═══════════════════════════════════════════════════════════════════════
-- CALL TDR_APP.ML_MODELS.RETRAIN_PROPENSITY_MODEL();


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 8: RE-SCORE ALL PIPELINE DEALS
-- ═══════════════════════════════════════════════════════════════════════
-- CALL TDR_APP.ML_MODELS.SCORE_PIPELINE_DEALS();


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 9: VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════

-- Training data volume (should be < uncapped ML_TRAINING_DATA):
-- SELECT
--     'ML_TRAINING_DATA_CLEAN' AS view_name,
--     COUNT(*) AS total,
--     SUM(IS_WON_LABEL) AS won,
--     COUNT(*) - SUM(IS_WON_LABEL) AS lost,
--     ROUND(SUM(IS_WON_LABEL)::FLOAT / COUNT(*) * 100, 1) AS win_rate_pct
-- FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA_CLEAN
-- UNION ALL
-- SELECT
--     'ML_TRAINING_DATA (uncapped)',
--     COUNT(*),
--     SUM(IS_WON_LABEL),
--     COUNT(*) - SUM(IS_WON_LABEL),
--     ROUND(SUM(IS_WON_LABEL)::FLOAT / COUNT(*) * 100, 1)
-- FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA;

-- DAYS_IN_PIPELINE distribution (should max at 730):
-- SELECT
--     MIN(DAYS_IN_PIPELINE) AS min_days,
--     MAX(DAYS_IN_PIPELINE) AS max_days,
--     AVG(DAYS_IN_PIPELINE) AS avg_days,
--     MEDIAN(DAYS_IN_PIPELINE) AS median_days
-- FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA_CLEAN;

-- Score distribution check (target: no bucket > 25%):
-- SELECT
--     FLOOR(PROPENSITY_SCORE * 10) / 10 AS score_bucket,
--     COUNT(*) AS deal_count,
--     ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct_of_total
-- FROM TDR_APP.ML_MODELS.DEAL_PREDICTIONS
-- GROUP BY score_bucket
-- ORDER BY score_bucket;

-- Model evaluation:
-- CALL TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_EVALUATION_METRICS();
-- CALL TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_FEATURE_IMPORTANCE();

-- Prediction snapshot count:
-- SELECT COUNT(*) AS snapshot_rows,
--        COUNT(DISTINCT OPPORTUNITY_ID) AS unique_deals,
--        MIN(SNAPSHOT_TAKEN_AT) AS earliest,
--        MAX(SNAPSHOT_TAKEN_AT) AS latest
-- FROM TDR_APP.ML_MODELS.PREDICTION_SNAPSHOTS;

-- Model metadata with metrics:
-- SELECT MODEL_VERSION, IS_PRODUCTION, TRAINING_ROW_COUNT,
--        POSITIVE_CLASS_COUNT, NEGATIVE_CLASS_COUNT,
--        F1_SCORE, PRECISION_SCORE, RECALL_SCORE,
--        EVALUATION_METRICS IS NOT NULL AS HAS_EVAL_METRICS,
--        FEATURE_IMPORTANCE IS NOT NULL AS HAS_FEAT_IMPORTANCE,
--        TRAINED_AT
-- FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
-- ORDER BY TRAINED_AT DESC;
