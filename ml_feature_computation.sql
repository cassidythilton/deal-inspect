-- =============================================================================
-- ML FEATURE COMPUTATION STORED PROCEDURE
-- =============================================================================
-- Populates ML_FEATURE_STORE from the opportunitiesmagic Domo dataset
-- Computes all derived features for ML model training and inference
-- =============================================================================

CREATE OR REPLACE PROCEDURE TDR_APP.ML_MODELS.SP_COMPUTE_ML_FEATURES(
    SOURCE_TABLE VARCHAR,           -- Fully qualified Domo source table name
    INCREMENTAL_MODE BOOLEAN DEFAULT FALSE,  -- TRUE = only process new/changed records
    FEATURE_VERSION VARCHAR DEFAULT 'v1'     -- Version tag for feature engineering
)
RETURNS VARIANT
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    rows_inserted INTEGER DEFAULT 0;
    rows_updated INTEGER DEFAULT 0;
    execution_start TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP();
    result VARIANT;
BEGIN
    -- =========================================================================
    -- STEP 1: Create temporary staging table with all computed features
    -- =========================================================================
    
    CREATE OR REPLACE TEMPORARY TABLE _feature_staging AS
    WITH 
    -- Compute segment-level stage age averages for velocity ratio
    segment_stage_averages AS (
        SELECT 
            "Sales Segment" AS sales_segment,
            AVG(NULLIF("Stage Age", 0)) AS avg_stage_age
        FROM IDENTIFIER(:SOURCE_TABLE)
        WHERE "Sales Segment" IS NOT NULL
          AND "Stage Age" IS NOT NULL
          AND "Stage Age" > 0
        GROUP BY "Sales Segment"
    ),
    
    -- Main feature computation
    computed_features AS (
        SELECT
            -- Primary identifiers
            UUID_STRING() AS feature_id,
            o."Opportunity Id" AS opportunity_id,
            o."Deal Code" AS account_id,
            
            -- Timestamps
            CURRENT_DATE() AS feature_date,
            CURRENT_TIMESTAMP() AS computed_at,
            
            -- =====================================================================
            -- ACCOUNT_WIN_RATE: Total Closed Won Count / (Won + Lost)
            -- Uses account-level counts embedded in each row
            -- =====================================================================
            CASE 
                WHEN COALESCE(o."Total Closed Won Count", 0) + COALESCE(o."Total Closed Lost Count", 0) > 0
                THEN o."Total Closed Won Count"::FLOAT / 
                     (o."Total Closed Won Count" + o."Total Closed Lost Count")::FLOAT
                ELSE NULL
            END AS account_win_rate,
            
            -- =====================================================================
            -- TYPE_SPECIFIC_WIN_RATE: Uses type-specific won/lost counts
            -- New Logo uses New Logo counts, Upsell uses Upsell counts
            -- =====================================================================
            CASE 
                WHEN o."Type" = 'New Logo' AND 
                     (COALESCE(o."New Logo Won Count", 0) + COALESCE(o."New Logo Lost Count", 0)) > 0
                THEN o."New Logo Won Count"::FLOAT / 
                     (o."New Logo Won Count" + o."New Logo Lost Count")::FLOAT
                WHEN o."Type" IN ('Upsell', 'Acquisition') AND 
                     (COALESCE(o."Upsell Won Count", 0) + COALESCE(o."Upsell Lost Count", 0)) > 0
                THEN o."Upsell Won Count"::FLOAT / 
                     (o."Upsell Won Count" + o."Upsell Lost Count")::FLOAT
                ELSE NULL
            END AS type_specific_win_rate,
            
            -- =====================================================================
            -- STAGE_VELOCITY_RATIO: Stage Age / Average Stage Age for Segment
            -- Values > 1 indicate slower than average progression
            -- =====================================================================
            CASE 
                WHEN ssa.avg_stage_age IS NOT NULL AND ssa.avg_stage_age > 0
                THEN o."Stage Age"::FLOAT / ssa.avg_stage_age
                ELSE NULL
            END AS stage_velocity_ratio,
            
            -- =====================================================================
            -- QUARTER_URGENCY: Proximity to quarter end (0-1 scale)
            -- Higher values = closer to quarter end
            -- =====================================================================
            CASE 
                WHEN o."Close Date" IS NOT NULL
                THEN 1.0 - (
                    DATEDIFF('day', 
                        TO_TIMESTAMP(o."Close Date" / 1000),
                        DATE_TRUNC('quarter', TO_TIMESTAMP(o."Close Date" / 1000)) + INTERVAL '3 months - 1 day'
                    )::FLOAT / 90.0
                )
                ELSE NULL
            END AS quarter_urgency,
            
            -- Days in current stage (from Stage Age field)
            o."Stage Age" AS days_in_current_stage,
            
            -- Days since created
            CASE 
                WHEN o."Created Date" IS NOT NULL
                THEN DATEDIFF('day', TO_TIMESTAMP(o."Created Date" / 1000), CURRENT_TIMESTAMP())
                ELSE NULL
            END AS days_since_created,
            
            -- =====================================================================
            -- DEAL_COMPLEXITY_INDEX: Normalized complexity score
            -- Combines line items, competitors, and services presence
            -- =====================================================================
            (
                COALESCE(o."Line Items", 0) * 0.3 +
                COALESCE(o."Number of Competitors", 0) * 0.4 +
                CASE WHEN COALESCE(o."Professional Services Price", 0) > 0 THEN 3 ELSE 0 END * 0.3
            ) AS deal_complexity_index,
            
            o."Number of Competitors" AS competitor_count,
            o."Line Items" AS line_item_count,
            
            -- =====================================================================
            -- SERVICES_RATIO: Professional Services / Total Price
            -- =====================================================================
            CASE 
                WHEN COALESCE(o."Platform Price", 0) + COALESCE(o."Professional Services Price", 0) > 0
                THEN COALESCE(o."Professional Services Price", 0)::FLOAT / 
                     (COALESCE(o."Platform Price", 0) + COALESCE(o."Professional Services Price", 0))::FLOAT
                ELSE 0
            END AS services_ratio,
            
            -- =====================================================================
            -- ACV_NORMALIZED: ACV normalized within segment using z-score approach
            -- Computed in second pass after segment stats are known
            -- =====================================================================
            o."ACV (USD)" AS acv_raw,  -- Will normalize in final insert
            o."Sales Segment" AS sales_segment_raw,  -- For normalization lookup
            
            -- =====================================================================
            -- REVENUE_PER_EMPLOYEE: Deal ACV / Account Employee Count
            -- =====================================================================
            CASE 
                WHEN COALESCE(o."Account Employees", 0) > 0
                THEN o."ACV (USD)"::FLOAT / o."Account Employees"::FLOAT
                ELSE NULL
            END AS revenue_per_employee,
            
            -- =====================================================================
            -- SALES_PROCESS_COMPLETENESS: Non-null milestones / 7 total milestones
            -- Milestones: Discovery, Demo, Pricing, Verbal Agreement, Firm Date, 
            --             Gate Call, and one of StageDate indicators
            -- =====================================================================
            (
                CASE WHEN o."Discovery Call Completed" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Demo Completed Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Pricing Call Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Verbal Agreement Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Firm Date Agreed Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Gate Call Completed" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN COALESCE(o."StageDate1", o."StageDate2", o."StageDate3", 
                                   o."StageDate4", o."StageDate5") IS NOT NULL THEN 1 ELSE 0 END
            )::FLOAT / 7.0 AS sales_process_completeness,
            
            -- Steps completed (count of non-null milestone dates)
            (
                CASE WHEN o."Discovery Call Completed" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Demo Completed Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Pricing Call Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Verbal Agreement Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Firm Date Agreed Date" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Gate Call Completed" IS NOT NULL THEN 1 ELSE 0 END +
                CASE WHEN o."Has Pre-Call Plan" = 'Yes' THEN 1 ELSE 0 END +
                CASE WHEN o."Has ADM/AE Sync Agenda" = 'Yes' THEN 1 ELSE 0 END
            ) AS steps_completed,
            
            8 AS total_steps,  -- Total available steps
            
            -- Has thesis (derived from People AI Engagement Level being set)
            CASE WHEN o."People AI Engagement Level" IS NOT NULL THEN TRUE ELSE FALSE END AS has_thesis,
            
            -- Has stakeholders (derived from Snowflake Team Picklist being populated)
            CASE WHEN o."Snowflake Team Picklist" IS NOT NULL 
                  AND o."Snowflake Team Picklist" != '' THEN TRUE ELSE FALSE END AS has_stakeholders,
            
            -- =====================================================================
            -- STAGE_ORDINAL: Extract stage number from format "2: Determine Needs"
            -- =====================================================================
            CASE 
                WHEN o."Stage" LIKE '1:%' THEN 1
                WHEN o."Stage" LIKE '2:%' THEN 2
                WHEN o."Stage" LIKE '3:%' THEN 3
                WHEN o."Stage" LIKE '4:%' THEN 4
                WHEN o."Stage" LIKE '5:%' THEN 5
                WHEN o."Stage" LIKE '6:%' OR LOWER(o."Stage") LIKE '%won%' THEN 6
                WHEN o."Stage" LIKE '7:%' OR LOWER(o."Stage") LIKE '%lost%' THEN 7
                ELSE TRY_TO_NUMBER(SPLIT_PART(o."Stage", ':', 1))
            END AS stage_ordinal,
            
            -- =====================================================================
            -- DEAL_COMPLEXITY_ENCODED: Categorical encoding
            -- 1 = Low, 2 = Medium, 3 = High
            -- =====================================================================
            CASE 
                WHEN COALESCE(o."Line Items", 0) <= 2 
                     AND COALESCE(o."Number of Competitors", 0) <= 1
                     AND COALESCE(o."Professional Services Price", 0) = 0
                THEN 1  -- Low
                WHEN COALESCE(o."Line Items", 0) >= 5 
                     OR COALESCE(o."Number of Competitors", 0) >= 3
                     OR COALESCE(o."Professional Services Price", 0) > 50000
                THEN 3  -- High
                ELSE 2  -- Medium
            END AS deal_complexity_encoded,
            
            -- =====================================================================
            -- AI_MATURITY_ENCODED: Based on People AI Engagement Level
            -- =====================================================================
            CASE 
                WHEN o."People AI Engagement Level" IS NULL THEN 1
                WHEN LOWER(o."People AI Engagement Level") LIKE '%low%' THEN 2
                WHEN LOWER(o."People AI Engagement Level") LIKE '%medium%' 
                     OR LOWER(o."People AI Engagement Level") LIKE '%moderate%' THEN 3
                WHEN LOWER(o."People AI Engagement Level") LIKE '%high%' THEN 4
                WHEN LOWER(o."People AI Engagement Level") LIKE '%very high%' 
                     OR LOWER(o."People AI Engagement Level") LIKE '%critical%' THEN 5
                ELSE 3  -- Default to medium
            END AS ai_maturity_encoded,
            
            :FEATURE_VERSION AS feature_version
            
        FROM IDENTIFIER(:SOURCE_TABLE) o
        LEFT JOIN segment_stage_averages ssa 
            ON o."Sales Segment" = ssa.sales_segment
        WHERE o."Opportunity Id" IS NOT NULL
    ),
    
    -- Compute segment-level ACV statistics for normalization
    segment_acv_stats AS (
        SELECT 
            sales_segment_raw AS sales_segment,
            AVG(acv_raw) AS avg_acv,
            STDDEV(acv_raw) AS stddev_acv
        FROM computed_features
        WHERE acv_raw IS NOT NULL
        GROUP BY sales_segment_raw
    )
    
    -- Final feature set with normalized ACV
    SELECT 
        cf.feature_id,
        cf.opportunity_id,
        cf.account_id,
        cf.feature_date,
        cf.computed_at,
        cf.account_win_rate,
        cf.type_specific_win_rate,
        cf.stage_velocity_ratio,
        cf.quarter_urgency,
        cf.days_in_current_stage,
        cf.days_since_created,
        cf.deal_complexity_index,
        cf.competitor_count,
        cf.line_item_count,
        cf.services_ratio,
        -- ACV Normalized using z-score within segment
        CASE 
            WHEN sas.stddev_acv IS NOT NULL AND sas.stddev_acv > 0
            THEN (cf.acv_raw - sas.avg_acv) / sas.stddev_acv
            ELSE 0
        END AS acv_normalized,
        cf.revenue_per_employee,
        cf.sales_process_completeness,
        cf.steps_completed,
        cf.total_steps,
        cf.has_thesis,
        cf.has_stakeholders,
        cf.stage_ordinal,
        cf.deal_complexity_encoded,
        cf.ai_maturity_encoded,
        cf.feature_version,
        NULL AS source_session_id  -- No TDR session for Domo-sourced features
    FROM computed_features cf
    LEFT JOIN segment_acv_stats sas 
        ON cf.sales_segment_raw = sas.sales_segment;
    
    -- =========================================================================
    -- STEP 2: Merge staging data into ML_FEATURE_STORE
    -- =========================================================================
    
    IF (:INCREMENTAL_MODE) THEN
        -- Incremental: Use MERGE to update existing and insert new
        MERGE INTO TDR_APP.ML_MODELS.ML_FEATURE_STORE AS target
        USING _feature_staging AS source
        ON target.OPPORTUNITY_ID = source.opportunity_id 
           AND target.FEATURE_DATE = source.feature_date
        WHEN MATCHED THEN UPDATE SET
            ACCOUNT_ID = source.account_id,
            COMPUTED_AT = source.computed_at,
            ACCOUNT_WIN_RATE = source.account_win_rate,
            TYPE_SPECIFIC_WIN_RATE = source.type_specific_win_rate,
            STAGE_VELOCITY_RATIO = source.stage_velocity_ratio,
            QUARTER_URGENCY = source.quarter_urgency,
            DAYS_IN_CURRENT_STAGE = source.days_in_current_stage,
            DAYS_SINCE_CREATED = source.days_since_created,
            DEAL_COMPLEXITY_INDEX = source.deal_complexity_index,
            COMPETITOR_COUNT = source.competitor_count,
            LINE_ITEM_COUNT = source.line_item_count,
            SERVICES_RATIO = source.services_ratio,
            ACV_NORMALIZED = source.acv_normalized,
            REVENUE_PER_EMPLOYEE = source.revenue_per_employee,
            SALES_PROCESS_COMPLETENESS = source.sales_process_completeness,
            STEPS_COMPLETED = source.steps_completed,
            TOTAL_STEPS = source.total_steps,
            HAS_THESIS = source.has_thesis,
            HAS_STAKEHOLDERS = source.has_stakeholders,
            STAGE_ORDINAL = source.stage_ordinal,
            DEAL_COMPLEXITY_ENCODED = source.deal_complexity_encoded,
            AI_MATURITY_ENCODED = source.ai_maturity_encoded,
            FEATURE_VERSION = source.feature_version,
            SOURCE_SESSION_ID = source.source_session_id
        WHEN NOT MATCHED THEN INSERT (
            FEATURE_ID, OPPORTUNITY_ID, ACCOUNT_ID, FEATURE_DATE, COMPUTED_AT,
            ACCOUNT_WIN_RATE, TYPE_SPECIFIC_WIN_RATE, STAGE_VELOCITY_RATIO,
            QUARTER_URGENCY, DAYS_IN_CURRENT_STAGE, DAYS_SINCE_CREATED,
            DEAL_COMPLEXITY_INDEX, COMPETITOR_COUNT, LINE_ITEM_COUNT,
            SERVICES_RATIO, ACV_NORMALIZED, REVENUE_PER_EMPLOYEE,
            SALES_PROCESS_COMPLETENESS, STEPS_COMPLETED, TOTAL_STEPS,
            HAS_THESIS, HAS_STAKEHOLDERS, STAGE_ORDINAL,
            DEAL_COMPLEXITY_ENCODED, AI_MATURITY_ENCODED,
            FEATURE_VERSION, SOURCE_SESSION_ID
        ) VALUES (
            source.feature_id, source.opportunity_id, source.account_id, 
            source.feature_date, source.computed_at,
            source.account_win_rate, source.type_specific_win_rate, source.stage_velocity_ratio,
            source.quarter_urgency, source.days_in_current_stage, source.days_since_created,
            source.deal_complexity_index, source.competitor_count, source.line_item_count,
            source.services_ratio, source.acv_normalized, source.revenue_per_employee,
            source.sales_process_completeness, source.steps_completed, source.total_steps,
            source.has_thesis, source.has_stakeholders, source.stage_ordinal,
            source.deal_complexity_encoded, source.ai_maturity_encoded,
            source.feature_version, source.source_session_id
        );
        
        -- Get counts from merge result
        rows_inserted := SQLROWCOUNT;
        
    ELSE
        -- Full refresh: Delete today's features and insert fresh
        DELETE FROM TDR_APP.ML_MODELS.ML_FEATURE_STORE
        WHERE FEATURE_DATE = CURRENT_DATE();
        
        rows_updated := SQLROWCOUNT;
        
        INSERT INTO TDR_APP.ML_MODELS.ML_FEATURE_STORE (
            FEATURE_ID, OPPORTUNITY_ID, ACCOUNT_ID, FEATURE_DATE, COMPUTED_AT,
            ACCOUNT_WIN_RATE, TYPE_SPECIFIC_WIN_RATE, STAGE_VELOCITY_RATIO,
            QUARTER_URGENCY, DAYS_IN_CURRENT_STAGE, DAYS_SINCE_CREATED,
            DEAL_COMPLEXITY_INDEX, COMPETITOR_COUNT, LINE_ITEM_COUNT,
            SERVICES_RATIO, ACV_NORMALIZED, REVENUE_PER_EMPLOYEE,
            SALES_PROCESS_COMPLETENESS, STEPS_COMPLETED, TOTAL_STEPS,
            HAS_THESIS, HAS_STAKEHOLDERS, STAGE_ORDINAL,
            DEAL_COMPLEXITY_ENCODED, AI_MATURITY_ENCODED,
            FEATURE_VERSION, SOURCE_SESSION_ID
        )
        SELECT 
            feature_id, opportunity_id, account_id, feature_date, computed_at,
            account_win_rate, type_specific_win_rate, stage_velocity_ratio,
            quarter_urgency, days_in_current_stage, days_since_created,
            deal_complexity_index, competitor_count, line_item_count,
            services_ratio, acv_normalized, revenue_per_employee,
            sales_process_completeness, steps_completed, total_steps,
            has_thesis, has_stakeholders, stage_ordinal,
            deal_complexity_encoded, ai_maturity_encoded,
            feature_version, source_session_id
        FROM _feature_staging;
        
        rows_inserted := SQLROWCOUNT;
    END IF;
    
    -- =========================================================================
    -- STEP 3: Cleanup and return results
    -- =========================================================================
    
    DROP TABLE IF EXISTS _feature_staging;
    
    result := OBJECT_CONSTRUCT(
        'status', 'SUCCESS',
        'execution_start', execution_start,
        'execution_end', CURRENT_TIMESTAMP(),
        'duration_seconds', DATEDIFF('second', execution_start, CURRENT_TIMESTAMP()),
        'source_table', :SOURCE_TABLE,
        'incremental_mode', :INCREMENTAL_MODE,
        'feature_version', :FEATURE_VERSION,
        'rows_inserted', rows_inserted,
        'rows_deleted_before_insert', rows_updated,
        'feature_date', CURRENT_DATE()
    );
    
    RETURN result;

EXCEPTION
    WHEN OTHER THEN
        DROP TABLE IF EXISTS _feature_staging;
        RETURN OBJECT_CONSTRUCT(
            'status', 'ERROR',
            'error_code', SQLCODE,
            'error_message', SQLERRM,
            'execution_start', execution_start,
            'source_table', :SOURCE_TABLE
        );
END;
$$;


-- =============================================================================
-- EXAMPLE USAGE
-- =============================================================================
-- Full refresh mode (replaces today's features):
-- CALL TDR_APP.ML_MODELS.SP_COMPUTE_ML_FEATURES(
--     'DOMO_DB.DOMO_SCHEMA.OPPORTUNITIESMAGIC',  -- Your Domo source table
--     FALSE,                                       -- Full refresh mode
--     'v1'                                         -- Feature version
-- );

-- Incremental mode (merge updates):
-- CALL TDR_APP.ML_MODELS.SP_COMPUTE_ML_FEATURES(
--     'DOMO_DB.DOMO_SCHEMA.OPPORTUNITIESMAGIC',
--     TRUE,                                        -- Incremental mode
--     'v1'
-- );


-- =============================================================================
-- GRANT EXECUTE PERMISSION
-- =============================================================================
GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SP_COMPUTE_ML_FEATURES(VARCHAR, BOOLEAN, VARCHAR) 
    TO ROLE TDR_APP_ROLE;
