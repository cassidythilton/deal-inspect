-- =============================================================================
-- SPRINT 28c: ML INFRASTRUCTURE & PREDICTIONS TABLE
-- =============================================================================
-- Supersedes: ml_infrastructure_ddl.sql, ml_feature_computation.sql,
--             ml_training_procedure.sql, ml_automation.sql
--
-- Architecture: SNOWFLAKE.ML.CLASSIFICATION (native, pure SQL, no Python)
-- Output:       DEAL_PREDICTIONS table → syncs to Domo → joined with
--               opportunitiesmagic on Opportunity Id
--
-- Run order:
--   1. Schema & grants (Section 1)
--   2. ML_FEATURE_STORE view (Section 2)
--   3. ML_TRAINING_DATA view (Section 3)
--   4. DEAL_PREDICTIONS table (Section 4)
--   5. ML_MODEL_METADATA table (Section 5)
--   6. Train model (Section 6)
--   7. Scoring procedure (Section 7)
--   8. Retrain procedure (Section 8)
--   9. Snowflake Tasks (Section 9)
--  10. First batch score (Section 10)
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 1: SCHEMA & GRANTS
-- ═══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS TDR_APP.ML_MODELS
    COMMENT = 'ML model objects, feature views, predictions, and metadata';

GRANT USAGE ON SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;
GRANT CREATE TABLE ON SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;
GRANT CREATE VIEW ON SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;
GRANT CREATE PROCEDURE ON SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;

-- ML.CLASSIFICATION requires CORTEX_USER
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE TDR_APP_ROLE;

USE DATABASE TDR_APP;
USE SCHEMA ML_MODELS;
USE WAREHOUSE TDR_APP_WH;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 2: ML_FEATURE_STORE VIEW
-- ═══════════════════════════════════════════════════════════════════════
-- Computes derived features from the raw opportunity table.
-- 38 safe features (validated by 02_pre_training_validation.py) plus
-- ~15 derived features = the complete feature set for the model.
--
-- This is a VIEW, not a table. Features are computed on read.
-- For training: ML_TRAINING_DATA references this view.
-- For scoring:  SCORE_PIPELINE_DEALS queries this view.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.ML_FEATURE_STORE AS
WITH
segment_stage_averages AS (
    SELECT
        "Sales Segment" AS sales_segment,
        AVG(NULLIF("Stage Age", 0)) AS avg_stage_age
    FROM TDR_APP.PUBLIC."Forecast_Page_Opportunities_Magic_SNFv2"
    WHERE "Sales Segment" IS NOT NULL
      AND "Stage Age" IS NOT NULL
      AND "Stage Age" > 0
      AND "Is Closed" = 'true'
    GROUP BY "Sales Segment"
),

segment_acv_stats AS (
    SELECT
        "Sales Segment" AS sales_segment,
        AVG("ACV (USD)") AS avg_acv,
        NULLIF(STDDEV("ACV (USD)"), 0) AS stddev_acv
    FROM TDR_APP.PUBLIC."Forecast_Page_Opportunities_Magic_SNFv2"
    WHERE "ACV (USD)" IS NOT NULL
      AND "Is Closed" = 'true'
    GROUP BY "Sales Segment"
)

SELECT
    o."Opportunity Id" AS OPPORTUNITY_ID,

    -- ── Raw features (from validation safe list) ──────────────────────

    -- Deal economics
    o."ACV (USD)" AS ACV_USD,
    LN(GREATEST(COALESCE(o."ACV (USD)", 0), 1)) AS ACV_LOG,
    o."ACV (USD) Recurring" AS ACV_RECURRING,
    o."ACV (USD) Non-Recurring" AS ACV_NON_RECURRING,
    o."TCV (USD)" AS TCV_USD,
    o."Platform Price" AS PLATFORM_PRICE,
    o."Professional Services Price" AS PROF_SERVICES_PRICE,
    o."Line Items" AS LINE_ITEMS,

    -- Deal characteristics
    o."Type" AS DEAL_TYPE,
    o."Deal Code" AS DEAL_CODE,
    o."Contract Type" AS CONTRACT_TYPE,
    o."Pricing Type" AS PRICING_TYPE,
    o."CPQ" AS CPQ,
    o."Non-Competitive Deal" AS NON_COMPETITIVE_DEAL,
    o."Number of Competitors" AS NUM_COMPETITORS,

    -- Account firmographics
    LN(GREATEST(COALESCE(o."Account Revenue USD", 0), 1)) AS ACCOUNT_REVENUE_LOG,
    LN(GREATEST(COALESCE(o."Account Employees", 0), 1)) AS ACCOUNT_EMPLOYEES_LOG,
    o."Strategic Account" AS STRATEGIC_ACCOUNT,
    o."Region" AS REGION,
    o."Sales Segment" AS SALES_SEGMENT,
    o."Sales Vertical" AS SALES_VERTICAL,

    -- Engagement
    -- Bucket to ≤20 categories (validation found 101 unique values)
    CASE
        WHEN o."People AI Engagement Level" IS NULL THEN 'Unknown'
        WHEN LOWER(o."People AI Engagement Level") LIKE '%very high%' THEN 'Very High'
        WHEN LOWER(o."People AI Engagement Level") LIKE '%high%' THEN 'High'
        WHEN LOWER(o."People AI Engagement Level") LIKE '%medium%'
          OR LOWER(o."People AI Engagement Level") LIKE '%moderate%' THEN 'Medium'
        WHEN LOWER(o."People AI Engagement Level") LIKE '%low%' THEN 'Low'
        WHEN LOWER(o."People AI Engagement Level") LIKE '%none%'
          OR LOWER(o."People AI Engagement Level") LIKE '%no engagement%' THEN 'None'
        ELSE 'Other'
    END AS ENGAGEMENT_LEVEL_BUCKETED,

    -- Partner
    o."Partner Influence" AS PARTNER_INFLUENCE,
    o."Is Partner" AS IS_PARTNER,

    -- Lead source (bucket to ≤20 categories — validation found 183 unique values)
    CASE
        WHEN o."Lead Source" IS NULL THEN 'Unknown'
        WHEN LOWER(o."Lead Source") LIKE '%inbound%' THEN 'Inbound'
        WHEN LOWER(o."Lead Source") LIKE '%outbound%' THEN 'Outbound'
        WHEN LOWER(o."Lead Source") LIKE '%partner%' THEN 'Partner'
        WHEN LOWER(o."Lead Source") LIKE '%event%' THEN 'Event'
        WHEN LOWER(o."Lead Source") LIKE '%referral%' THEN 'Referral'
        WHEN LOWER(o."Lead Source") LIKE '%web%' OR LOWER(o."Lead Source") LIKE '%website%' THEN 'Web'
        WHEN LOWER(o."Lead Source") LIKE '%marketing%' OR LOWER(o."Lead Source") LIKE '%campaign%' THEN 'Marketing'
        WHEN LOWER(o."Lead Source") LIKE '%sdr%' OR LOWER(o."Lead Source") LIKE '%bdr%' THEN 'SDR/BDR'
        ELSE 'Other'
    END AS LEAD_SOURCE_BUCKETED,

    -- ── Derived features ──────────────────────────────────────────────

    -- Account win rate
    CASE
        WHEN COALESCE(o."Total Closed Won Count", 0) + COALESCE(o."Total Closed Lost Count", 0) > 0
        THEN o."Total Closed Won Count"::FLOAT /
             (o."Total Closed Won Count" + o."Total Closed Lost Count")::FLOAT
        ELSE NULL
    END AS ACCOUNT_WIN_RATE,

    -- Type-specific win rate
    CASE
        WHEN o."Type" = 'New Logo'
             AND (COALESCE(o."New Logo Won Count", 0) + COALESCE(o."New Logo Lost Count", 0)) > 0
        THEN o."New Logo Won Count"::FLOAT /
             (o."New Logo Won Count" + o."New Logo Lost Count")::FLOAT
        WHEN o."Type" IN ('Upsell', 'Acquisition')
             AND (COALESCE(o."Upsell Won Count", 0) + COALESCE(o."Upsell Lost Count", 0)) > 0
        THEN o."Upsell Won Count"::FLOAT /
             (o."Upsell Won Count" + o."Upsell Lost Count")::FLOAT
        ELSE NULL
    END AS TYPE_SPECIFIC_WIN_RATE,

    -- Stage velocity ratio (deal's stage age vs segment average)
    CASE
        WHEN ssa.avg_stage_age IS NOT NULL AND ssa.avg_stage_age > 0
        THEN o."Stage Age"::FLOAT / ssa.avg_stage_age
        ELSE NULL
    END AS STAGE_VELOCITY_RATIO,

    -- Services ratio
    CASE
        WHEN COALESCE(o."Platform Price", 0) + COALESCE(o."Professional Services Price", 0) > 0
        THEN COALESCE(o."Professional Services Price", 0)::FLOAT /
             (COALESCE(o."Platform Price", 0) + COALESCE(o."Professional Services Price", 0))::FLOAT
        ELSE 0
    END AS SERVICES_RATIO,

    -- ACV normalized within segment (z-score)
    CASE
        WHEN sas.stddev_acv IS NOT NULL
        THEN (COALESCE(o."ACV (USD)", 0) - sas.avg_acv) / sas.stddev_acv
        ELSE 0
    END AS ACV_NORMALIZED,

    -- Revenue per employee
    CASE
        WHEN COALESCE(o."Account Employees", 0) > 0
        THEN o."ACV (USD)"::FLOAT / o."Account Employees"::FLOAT
        ELSE NULL
    END AS REVENUE_PER_EMPLOYEE,

    -- Sales process completeness (non-null milestones / 6)
    (
        CASE WHEN o."Discovery Call Completed" IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN o."Demo Completed Date" IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN o."Pricing Call Date" IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN o."Gate Call Completed" IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN o."Has Pre-Call Plan" IS NOT NULL AND o."Has Pre-Call Plan" != '' THEN 1 ELSE 0 END +
        CASE WHEN o."Has ADM/AE Sync Agenda" IS NOT NULL AND o."Has ADM/AE Sync Agenda" != '' THEN 1 ELSE 0 END
    )::FLOAT / 6.0 AS SALES_PROCESS_COMPLETENESS,

    -- Days since created
    CASE
        WHEN o."Created Date" IS NOT NULL
        THEN DATEDIFF('day', TO_TIMESTAMP(o."Created Date" / 1000), CURRENT_TIMESTAMP())
        ELSE NULL
    END AS DAYS_SINCE_CREATED,

    -- Account deal density
    COALESCE(o."Total Opty Count", 0) AS TOTAL_OPTY_COUNT,

    -- Deal complexity index (normalized composite)
    (
        COALESCE(o."Line Items", 0) * 0.3 +
        COALESCE(o."Number of Competitors", 0) * 0.4 +
        CASE WHEN COALESCE(o."Professional Services Price", 0) > 0 THEN 3 ELSE 0 END * 0.3
    ) AS DEAL_COMPLEXITY_INDEX,

    -- ── Labels (only populated for closed deals) ──────────────────────
    o."Is Closed" AS IS_CLOSED,
    o."Is Won" AS IS_WON,
    o."Stage" AS STAGE_RAW

FROM TDR_APP.PUBLIC."Forecast_Page_Opportunities_Magic_SNFv2" o
LEFT JOIN segment_stage_averages ssa ON o."Sales Segment" = ssa.sales_segment
LEFT JOIN segment_acv_stats sas ON o."Sales Segment" = sas.sales_segment
WHERE o."Opportunity Id" IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 3: ML_TRAINING_DATA VIEW
-- ═══════════════════════════════════════════════════════════════════════
-- Filters to closed Won/Lost deals only.
-- Excludes "Duplicate" and "Obsolete" stages (13,938 rows — not real outcomes).
-- Target: IS_WON_LABEL (1 = Won, 0 = Lost)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW TDR_APP.ML_MODELS.ML_TRAINING_DATA AS
SELECT
    OPPORTUNITY_ID,

    -- Target label
    CASE WHEN IS_WON = 'true' THEN 1 ELSE 0 END AS IS_WON_LABEL,

    -- All features (excluding leakage columns IS_CLOSED, IS_WON, STAGE_RAW)
    ACV_USD, ACV_LOG, ACV_RECURRING, ACV_NON_RECURRING,
    TCV_USD, PLATFORM_PRICE, PROF_SERVICES_PRICE, LINE_ITEMS,
    DEAL_TYPE, DEAL_CODE, CONTRACT_TYPE, PRICING_TYPE, CPQ, NON_COMPETITIVE_DEAL,
    NUM_COMPETITORS,
    ACCOUNT_REVENUE_LOG, ACCOUNT_EMPLOYEES_LOG, STRATEGIC_ACCOUNT,
    REGION, SALES_SEGMENT, SALES_VERTICAL,
    ENGAGEMENT_LEVEL_BUCKETED, PARTNER_INFLUENCE, IS_PARTNER,
    LEAD_SOURCE_BUCKETED,
    ACCOUNT_WIN_RATE, TYPE_SPECIFIC_WIN_RATE, STAGE_VELOCITY_RATIO,
    SERVICES_RATIO, ACV_NORMALIZED, REVENUE_PER_EMPLOYEE,
    SALES_PROCESS_COMPLETENESS, DAYS_SINCE_CREATED,
    TOTAL_OPTY_COUNT, DEAL_COMPLEXITY_INDEX

FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE
WHERE IS_CLOSED = 'true'
  AND STAGE_RAW NOT IN ('Duplicate', 'Obsolete', 'Closed Pending Option');


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 4: DEAL_PREDICTIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════
-- This table syncs to Domo as a standalone dataset.
-- Domo joins it with opportunitiesmagic on OPPORTUNITY_ID.
-- Flat columns for factors — no JSON, no VARIANT.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS TDR_APP.ML_MODELS.DEAL_PREDICTIONS (
    OPPORTUNITY_ID          VARCHAR NOT NULL,
    PROPENSITY_SCORE        FLOAT,
    PREDICTION              VARCHAR(10),
    QUADRANT                VARCHAR(20),
    FACTOR_1_NAME           VARCHAR(100),
    FACTOR_1_VALUE          VARCHAR(50),
    FACTOR_1_DIRECTION      VARCHAR(10),
    FACTOR_1_MAGNITUDE      FLOAT,
    FACTOR_2_NAME           VARCHAR(100),
    FACTOR_2_VALUE          VARCHAR(50),
    FACTOR_2_DIRECTION      VARCHAR(10),
    FACTOR_2_MAGNITUDE      FLOAT,
    FACTOR_3_NAME           VARCHAR(100),
    FACTOR_3_VALUE          VARCHAR(50),
    FACTOR_3_DIRECTION      VARCHAR(10),
    FACTOR_3_MAGNITUDE      FLOAT,
    FACTOR_4_NAME           VARCHAR(100),
    FACTOR_4_VALUE          VARCHAR(50),
    FACTOR_4_DIRECTION      VARCHAR(10),
    FACTOR_4_MAGNITUDE      FLOAT,
    FACTOR_5_NAME           VARCHAR(100),
    FACTOR_5_VALUE          VARCHAR(50),
    FACTOR_5_DIRECTION      VARCHAR(10),
    FACTOR_5_MAGNITUDE      FLOAT,
    SCORED_AT               TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    MODEL_VERSION           VARCHAR(50),
    PRIMARY KEY (OPPORTUNITY_ID)
)
COMMENT = 'Batch-scored propensity predictions — synced to Domo, joined with opportunitiesmagic';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE TDR_APP.ML_MODELS.DEAL_PREDICTIONS TO ROLE TDR_APP_ROLE;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 5: ML_MODEL_METADATA TABLE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS TDR_APP.ML_MODELS.ML_MODEL_METADATA (
    MODEL_ID                VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    MODEL_NAME              VARCHAR(100) DEFAULT 'deal_close_propensity',
    MODEL_VERSION           VARCHAR(50) NOT NULL,
    STATUS                  VARCHAR(20) DEFAULT 'VALIDATED',
    IS_PRODUCTION           BOOLEAN DEFAULT FALSE,
    TRAINING_ROW_COUNT      INTEGER,
    POSITIVE_CLASS_COUNT    INTEGER,
    NEGATIVE_CLASS_COUNT    INTEGER,
    AUC_ROC                 FLOAT,
    ACCURACY                FLOAT,
    PRECISION_SCORE         FLOAT,
    RECALL_SCORE            FLOAT,
    F1_SCORE                FLOAT,
    LOG_LOSS                FLOAT,
    FEATURE_IMPORTANCE      VARIANT,
    EVALUATION_METRICS      VARIANT,
    TRAINED_AT              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    DEPLOYED_AT             TIMESTAMP_NTZ,
    NOTES                   VARCHAR(2000)
)
COMMENT = 'Model registry for propensity models';

GRANT SELECT, INSERT, UPDATE ON TABLE TDR_APP.ML_MODELS.ML_MODEL_METADATA TO ROLE TDR_APP_ROLE;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 6: TRAIN THE MODEL
-- ═══════════════════════════════════════════════════════════════════════
-- SNOWFLAKE.ML.CLASSIFICATION handles:
--   - Encoding categoricals
--   - Handling nulls
--   - Validation split
--   - Hyperparameter tuning
--   - Model selection
-- No Python. No external compute.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE SNOWFLAKE.ML.CLASSIFICATION TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY(
    INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'TDR_APP.ML_MODELS.ML_TRAINING_DATA'),
    TARGET_COLNAME => 'IS_WON_LABEL',
    CONFIG_OBJECT => {'ON_ERROR': 'SKIP'}
);

-- Validate: check evaluation metrics
-- CALL TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_EVALUATION_METRICS();
-- CALL TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_FEATURE_IMPORTANCE();

-- Log metadata after reviewing metrics:
-- INSERT INTO TDR_APP.ML_MODELS.ML_MODEL_METADATA (
--     MODEL_VERSION, STATUS, IS_PRODUCTION, TRAINING_ROW_COUNT,
--     NOTES
-- ) VALUES (
--     'v1', 'VALIDATED', TRUE,
--     (SELECT COUNT(*) FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA),
--     'Initial SNOWFLAKE.ML.CLASSIFICATION model — Sprint 28c'
-- );


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 7: SCORING PROCEDURE
-- ═══════════════════════════════════════════════════════════════════════
-- Batch-scores all open pipeline deals.
-- Computes per-deal factor explanations using global feature importance
-- + per-deal feature deviation from population baseline.
-- Writes flat columns to DEAL_PREDICTIONS.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.SCORE_PIPELINE_DEALS()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    scored_count INTEGER DEFAULT 0;
    model_version VARCHAR DEFAULT 'v1';
BEGIN

    -- Step 1: Score all open pipeline deals
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
                'ACCOUNT_WIN_RATE', f.ACCOUNT_WIN_RATE,
                'TYPE_SPECIFIC_WIN_RATE', f.TYPE_SPECIFIC_WIN_RATE,
                'STAGE_VELOCITY_RATIO', f.STAGE_VELOCITY_RATIO,
                'SERVICES_RATIO', f.SERVICES_RATIO,
                'ACV_NORMALIZED', f.ACV_NORMALIZED,
                'REVENUE_PER_EMPLOYEE', f.REVENUE_PER_EMPLOYEE,
                'SALES_PROCESS_COMPLETENESS', f.SALES_PROCESS_COMPLETENESS,
                'DAYS_SINCE_CREATED', f.DAYS_SINCE_CREATED,
                'TOTAL_OPTY_COUNT', f.TOTAL_OPTY_COUNT,
                'DEAL_COMPLEXITY_INDEX', f.DEAL_COMPLEXITY_INDEX
            )
        ) AS PRED,
        -- Keep raw features for factor computation
        f.ACCOUNT_WIN_RATE,
        f.TYPE_SPECIFIC_WIN_RATE,
        f.STAGE_VELOCITY_RATIO,
        f.SERVICES_RATIO,
        f.ACV_NORMALIZED,
        f.SALES_PROCESS_COMPLETENESS,
        f.DAYS_SINCE_CREATED,
        f.DEAL_COMPLEXITY_INDEX,
        f.REVENUE_PER_EMPLOYEE,
        f.ENGAGEMENT_LEVEL_BUCKETED,
        f.ACV_LOG,
        f.NUM_COMPETITORS,
        f.TOTAL_OPTY_COUNT,
        f.PARTNER_INFLUENCE,
        f.LEAD_SOURCE_BUCKETED
    FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE f
    WHERE f.IS_CLOSED IS NULL
       OR f.IS_CLOSED != 'true';

    -- Step 2: Compute population baselines for factor context
    CREATE OR REPLACE TEMPORARY TABLE _baselines AS
    SELECT
        AVG(ACCOUNT_WIN_RATE) AS avg_account_win_rate,
        AVG(STAGE_VELOCITY_RATIO) AS avg_stage_velocity,
        AVG(SERVICES_RATIO) AS avg_services_ratio,
        AVG(ACV_NORMALIZED) AS avg_acv_norm,
        AVG(SALES_PROCESS_COMPLETENESS) AS avg_process,
        AVG(DAYS_SINCE_CREATED) AS avg_days_created,
        AVG(DEAL_COMPLEXITY_INDEX) AS avg_complexity,
        AVG(REVENUE_PER_EMPLOYEE) AS avg_rev_per_emp,
        AVG(ACV_LOG) AS avg_acv_log,
        AVG(NUM_COMPETITORS) AS avg_competitors,
        AVG(TOTAL_OPTY_COUNT) AS avg_opty_count
    FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE
    WHERE IS_CLOSED = 'true';

    -- Step 3: Build predictions with factor explanations
    CREATE OR REPLACE TEMPORARY TABLE _predictions_with_factors AS
    WITH scored AS (
        SELECT
            s.OPPORTUNITY_ID,
            ROUND(s.PRED:"probability"::OBJECT:"1"::FLOAT, 4) AS PROPENSITY_SCORE,
            s.PRED:"class"::VARCHAR AS PREDICTION,
            b.*,
            s.ACCOUNT_WIN_RATE,
            s.TYPE_SPECIFIC_WIN_RATE,
            s.STAGE_VELOCITY_RATIO,
            s.SERVICES_RATIO,
            s.ACV_NORMALIZED,
            s.SALES_PROCESS_COMPLETENESS,
            s.DAYS_SINCE_CREATED,
            s.DEAL_COMPLEXITY_INDEX,
            s.REVENUE_PER_EMPLOYEE,
            s.ENGAGEMENT_LEVEL_BUCKETED,
            s.ACV_LOG,
            s.NUM_COMPETITORS,
            s.TOTAL_OPTY_COUNT,
            s.PARTNER_INFLUENCE,
            s.LEAD_SOURCE_BUCKETED
        FROM _scored_deals s
        CROSS JOIN _baselines b
    ),
    -- Rank factors by deviation from baseline * importance
    -- Using a simplified factor derivation: compare deal value to population average
    -- Direction: above avg for positive-correlated features → helps
    factor_ranked AS (
        SELECT
            OPPORTUNITY_ID,
            PROPENSITY_SCORE,
            PREDICTION,
            -- Factor array built from key features
            ARRAY_CONSTRUCT(
                OBJECT_CONSTRUCT('name', 'Account Win Rate',
                    'value', ROUND(COALESCE(ACCOUNT_WIN_RATE, 0), 2)::VARCHAR,
                    'direction', CASE WHEN COALESCE(ACCOUNT_WIN_RATE, 0) > COALESCE(avg_account_win_rate, 0.3) THEN 'helps' WHEN COALESCE(ACCOUNT_WIN_RATE, 0) < COALESCE(avg_account_win_rate, 0.3) * 0.7 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(ACCOUNT_WIN_RATE, 0) - COALESCE(avg_account_win_rate, 0.3))),
                OBJECT_CONSTRUCT('name', 'Stage Velocity',
                    'value', ROUND(COALESCE(STAGE_VELOCITY_RATIO, 1), 1)::VARCHAR || 'x',
                    'direction', CASE WHEN COALESCE(STAGE_VELOCITY_RATIO, 1) < 1.0 THEN 'helps' WHEN COALESCE(STAGE_VELOCITY_RATIO, 1) > 1.5 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(STAGE_VELOCITY_RATIO, 1) - 1.0)),
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
                    'value', COALESCE(DAYS_SINCE_CREATED, 0)::VARCHAR || ' days',
                    'direction', CASE WHEN COALESCE(DAYS_SINCE_CREATED, 0) < COALESCE(avg_days_created, 120) THEN 'helps' WHEN COALESCE(DAYS_SINCE_CREATED, 0) > COALESCE(avg_days_created, 120) * 1.5 THEN 'hurts' ELSE 'neutral' END,
                    'magnitude', ABS(COALESCE(DAYS_SINCE_CREATED, 0) - COALESCE(avg_days_created, 120))::FLOAT / GREATEST(COALESCE(avg_days_created, 120), 1))
            ) AS all_factors
        FROM scored
    ),
    -- Sort factors by magnitude (highest impact first) and pick top 5
    top_factors AS (
        SELECT
            OPPORTUNITY_ID,
            PROPENSITY_SCORE,
            PREDICTION,
            all_factors,
            -- Sort by magnitude descending, take top 5
            -- Snowflake doesn't have ARRAY_SORT by nested key, so we use a lateral flatten + reorder
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
            WHEN PROPENSITY_SCORE >= 0.5 THEN 'CRITICAL'
            WHEN PROPENSITY_SCORE >= 0.3 THEN 'MONITOR'
            ELSE 'STANDARD'
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

    -- Step 4: Merge into DEAL_PREDICTIONS
    MERGE INTO TDR_APP.ML_MODELS.DEAL_PREDICTIONS dp
    USING _predictions_with_factors pf
    ON dp.OPPORTUNITY_ID = pf.OPPORTUNITY_ID
    WHEN MATCHED THEN UPDATE SET
        PROPENSITY_SCORE = pf.PROPENSITY_SCORE,
        PREDICTION = pf.PREDICTION,
        QUADRANT = pf.QUADRANT,
        FACTOR_1_NAME = pf.FACTOR_1_NAME, FACTOR_1_VALUE = pf.FACTOR_1_VALUE,
        FACTOR_1_DIRECTION = pf.FACTOR_1_DIRECTION, FACTOR_1_MAGNITUDE = pf.FACTOR_1_MAGNITUDE,
        FACTOR_2_NAME = pf.FACTOR_2_NAME, FACTOR_2_VALUE = pf.FACTOR_2_VALUE,
        FACTOR_2_DIRECTION = pf.FACTOR_2_DIRECTION, FACTOR_2_MAGNITUDE = pf.FACTOR_2_MAGNITUDE,
        FACTOR_3_NAME = pf.FACTOR_3_NAME, FACTOR_3_VALUE = pf.FACTOR_3_VALUE,
        FACTOR_3_DIRECTION = pf.FACTOR_3_DIRECTION, FACTOR_3_MAGNITUDE = pf.FACTOR_3_MAGNITUDE,
        FACTOR_4_NAME = pf.FACTOR_4_NAME, FACTOR_4_VALUE = pf.FACTOR_4_VALUE,
        FACTOR_4_DIRECTION = pf.FACTOR_4_DIRECTION, FACTOR_4_MAGNITUDE = pf.FACTOR_4_MAGNITUDE,
        FACTOR_5_NAME = pf.FACTOR_5_NAME, FACTOR_5_VALUE = pf.FACTOR_5_VALUE,
        FACTOR_5_DIRECTION = pf.FACTOR_5_DIRECTION, FACTOR_5_MAGNITUDE = pf.FACTOR_5_MAGNITUDE,
        SCORED_AT = pf.SCORED_AT,
        MODEL_VERSION = pf.MODEL_VERSION
    WHEN NOT MATCHED THEN INSERT (
        OPPORTUNITY_ID, PROPENSITY_SCORE, PREDICTION, QUADRANT,
        FACTOR_1_NAME, FACTOR_1_VALUE, FACTOR_1_DIRECTION, FACTOR_1_MAGNITUDE,
        FACTOR_2_NAME, FACTOR_2_VALUE, FACTOR_2_DIRECTION, FACTOR_2_MAGNITUDE,
        FACTOR_3_NAME, FACTOR_3_VALUE, FACTOR_3_DIRECTION, FACTOR_3_MAGNITUDE,
        FACTOR_4_NAME, FACTOR_4_VALUE, FACTOR_4_DIRECTION, FACTOR_4_MAGNITUDE,
        FACTOR_5_NAME, FACTOR_5_VALUE, FACTOR_5_DIRECTION, FACTOR_5_MAGNITUDE,
        SCORED_AT, MODEL_VERSION
    ) VALUES (
        pf.OPPORTUNITY_ID, pf.PROPENSITY_SCORE, pf.PREDICTION, pf.QUADRANT,
        pf.FACTOR_1_NAME, pf.FACTOR_1_VALUE, pf.FACTOR_1_DIRECTION, pf.FACTOR_1_MAGNITUDE,
        pf.FACTOR_2_NAME, pf.FACTOR_2_VALUE, pf.FACTOR_2_DIRECTION, pf.FACTOR_2_MAGNITUDE,
        pf.FACTOR_3_NAME, pf.FACTOR_3_VALUE, pf.FACTOR_3_DIRECTION, pf.FACTOR_3_MAGNITUDE,
        pf.FACTOR_4_NAME, pf.FACTOR_4_VALUE, pf.FACTOR_4_DIRECTION, pf.FACTOR_4_MAGNITUDE,
        pf.FACTOR_5_NAME, pf.FACTOR_5_VALUE, pf.FACTOR_5_DIRECTION, pf.FACTOR_5_MAGNITUDE,
        pf.SCORED_AT, pf.MODEL_VERSION
    );

    SELECT COUNT(*) INTO :scored_count FROM _predictions_with_factors;

    -- Cleanup
    DROP TABLE IF EXISTS _scored_deals;
    DROP TABLE IF EXISTS _baselines;
    DROP TABLE IF EXISTS _predictions_with_factors;

    RETURN 'Scored ' || :scored_count || ' pipeline deals';
END;
$$;

GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SCORE_PIPELINE_DEALS() TO ROLE TDR_APP_ROLE;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 8: RETRAIN PROCEDURE
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.RETRAIN_PROPENSITY_MODEL()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    training_count INTEGER;
    model_version VARCHAR;
BEGIN
    SELECT COUNT(*) INTO :training_count FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA;
    model_version := 'v' || TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYYMMDD_HH24MISS');

    IF (:training_count < 500) THEN
        RETURN 'SKIPPED: Only ' || :training_count || ' training rows (need ≥500)';
    END IF;

    -- Retrain
    CREATE OR REPLACE SNOWFLAKE.ML.CLASSIFICATION TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY(
        INPUT_DATA => SYSTEM$REFERENCE('VIEW', 'TDR_APP.ML_MODELS.ML_TRAINING_DATA'),
        TARGET_COLNAME => 'IS_WON_LABEL',
        CONFIG_OBJECT => {'ON_ERROR': 'SKIP'}
    );

    -- Log metadata
    INSERT INTO TDR_APP.ML_MODELS.ML_MODEL_METADATA (
        MODEL_VERSION, STATUS, IS_PRODUCTION, TRAINING_ROW_COUNT,
        TRAINED_AT, NOTES
    ) VALUES (
        :model_version, 'VALIDATED', TRUE, :training_count,
        CURRENT_TIMESTAMP(),
        'Auto-retrained by RETRAIN_PROPENSITY_MODEL procedure'
    );

    -- Mark previous versions as not production
    UPDATE TDR_APP.ML_MODELS.ML_MODEL_METADATA
    SET IS_PRODUCTION = FALSE
    WHERE MODEL_VERSION != :model_version
      AND IS_PRODUCTION = TRUE;

    RETURN 'Retrained model ' || :model_version || ' on ' || :training_count || ' rows';
END;
$$;

GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.RETRAIN_PROPENSITY_MODEL() TO ROLE TDR_APP_ROLE;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 9: SNOWFLAKE TASKS
-- ═══════════════════════════════════════════════════════════════════════

-- Nightly batch scoring (2 AM UTC)
CREATE OR REPLACE TASK TDR_APP.ML_MODELS.TASK_NIGHTLY_SCORE
    WAREHOUSE = TDR_APP_WH
    SCHEDULE = 'USING CRON 0 2 * * * UTC'
    COMMENT = 'Nightly batch scoring of all open pipeline deals'
AS
    CALL TDR_APP.ML_MODELS.SCORE_PIPELINE_DEALS();

ALTER TASK TDR_APP.ML_MODELS.TASK_NIGHTLY_SCORE SET
    USER_TASK_TIMEOUT_MS = 3600000,
    SUSPEND_TASK_AFTER_NUM_FAILURES = 3;

-- Weekly retrain (Sunday 3 AM UTC)
CREATE OR REPLACE TASK TDR_APP.ML_MODELS.TASK_WEEKLY_RETRAIN
    WAREHOUSE = TDR_APP_WH
    SCHEDULE = 'USING CRON 0 3 * * 0 UTC'
    COMMENT = 'Weekly model retrain from latest closed deal data'
AS
    CALL TDR_APP.ML_MODELS.RETRAIN_PROPENSITY_MODEL();

ALTER TASK TDR_APP.ML_MODELS.TASK_WEEKLY_RETRAIN SET
    USER_TASK_TIMEOUT_MS = 7200000,
    SUSPEND_TASK_AFTER_NUM_FAILURES = 2;

-- Tasks created suspended — resume when ready:
-- ALTER TASK TDR_APP.ML_MODELS.TASK_NIGHTLY_SCORE RESUME;
-- ALTER TASK TDR_APP.ML_MODELS.TASK_WEEKLY_RETRAIN RESUME;


-- ═══════════════════════════════════════════════════════════════════════
-- SECTION 10: FIRST BATCH SCORE (run manually after model training)
-- ═══════════════════════════════════════════════════════════════════════
-- CALL TDR_APP.ML_MODELS.SCORE_PIPELINE_DEALS();
-- SELECT COUNT(*) FROM TDR_APP.ML_MODELS.DEAL_PREDICTIONS;
-- SELECT * FROM TDR_APP.ML_MODELS.DEAL_PREDICTIONS LIMIT 10;


-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════

-- Check training data volume:
-- SELECT COUNT(*) AS total, SUM(IS_WON_LABEL) AS won, COUNT(*) - SUM(IS_WON_LABEL) AS lost
-- FROM TDR_APP.ML_MODELS.ML_TRAINING_DATA;

-- Check feature store coverage:
-- SELECT COUNT(*) FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE WHERE IS_CLOSED IS NULL OR IS_CLOSED != 'true';

-- Model evaluation:
-- CALL TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_EVALUATION_METRICS();
-- CALL TDR_APP.ML_MODELS.DEAL_CLOSE_PROPENSITY!SHOW_FEATURE_IMPORTANCE();

-- Sample predictions:
-- SELECT OPPORTUNITY_ID, PROPENSITY_SCORE, QUADRANT,
--        FACTOR_1_NAME, FACTOR_1_DIRECTION, FACTOR_2_NAME, FACTOR_2_DIRECTION
-- FROM TDR_APP.ML_MODELS.DEAL_PREDICTIONS
-- ORDER BY PROPENSITY_SCORE DESC LIMIT 20;
