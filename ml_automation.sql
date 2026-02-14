-- =============================================================================
-- ML PIPELINE AUTOMATION: TASKS, ALERTS, AND STREAMS
-- Target: TDR_APP.ML_MODELS schema
-- =============================================================================
-- This script creates the automation infrastructure for the ML pipeline:
--   1. Daily feature computation task (6am UTC)
--   2. Daily batch scoring task (7am UTC, after features)
--   3. Biweekly model retraining task
--   4. Weekly model performance alert
--   5. Change data capture stream for predictions
-- =============================================================================

USE SCHEMA TDR_APP.ML_MODELS;

-- =============================================================================
-- PREREQUISITE: CREATE MEDIUM WAREHOUSE FOR RETRAINING
-- =============================================================================
CREATE WAREHOUSE IF NOT EXISTS TDR_ML_TRAINING_WH
    WITH WAREHOUSE_SIZE = 'MEDIUM'
    AUTO_SUSPEND = 120
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Medium warehouse for ML model training workloads';

-- =============================================================================
-- PREREQUISITE: MONITORING TABLE FOR ALERTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS TDR_APP.ML_MODELS.ML_ALERT_LOG (
    ALERT_ID            VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    ALERT_NAME          VARCHAR(100) NOT NULL,
    ALERT_TYPE          VARCHAR(50) NOT NULL,
    TRIGGERED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ALERT_CONDITION     VARCHAR(1000),
    CURRENT_VALUE       FLOAT,
    THRESHOLD_VALUE     FLOAT,
    MODEL_VERSION       VARCHAR(50),
    SEVERITY            VARCHAR(20) DEFAULT 'WARNING',
    ACKNOWLEDGED        BOOLEAN DEFAULT FALSE,
    ACKNOWLEDGED_BY     VARCHAR(100),
    ACKNOWLEDGED_AT     TIMESTAMP_NTZ,
    NOTES               VARCHAR(2000)
)
COMMENT = 'Audit log for ML pipeline alerts and notifications';

-- =============================================================================
-- PREREQUISITE: NOTIFICATION INTEGRATION (IF EMAIL IS DESIRED)
-- =============================================================================
-- Uncomment and configure if you have email notification integration set up:
-- CREATE NOTIFICATION INTEGRATION IF NOT EXISTS ML_EMAIL_NOTIFICATION
--     TYPE = EMAIL
--     ENABLED = TRUE
--     ALLOWED_RECIPIENTS = ('ml-team@yourcompany.com', 'data-eng@yourcompany.com');

-- =============================================================================
-- GRANT STATEMENTS - PREREQUISITES FOR TASK EXECUTION
-- =============================================================================

-- Grant execute on warehouses
GRANT USAGE ON WAREHOUSE TDR_APP_WH TO ROLE TDR_APP_ROLE;
GRANT USAGE ON WAREHOUSE TDR_ML_TRAINING_WH TO ROLE TDR_APP_ROLE;

-- Grant execute task privilege (required for task owners)
GRANT EXECUTE TASK ON ACCOUNT TO ROLE TDR_APP_ROLE;
GRANT EXECUTE MANAGED TASK ON ACCOUNT TO ROLE TDR_APP_ROLE;

-- Grant execute on stored procedures (if not already granted)
GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SP_COMPUTE_ML_FEATURES(VARCHAR, VARCHAR) TO ROLE TDR_APP_ROLE;
GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SP_PREDICT_WIN_PROBABILITY(VARCHAR, VARCHAR) TO ROLE TDR_APP_ROLE;
GRANT USAGE ON PROCEDURE TDR_APP.ML_MODELS.SP_TRAIN_STACKING_ENSEMBLE(VARCHAR, VARCHAR) TO ROLE TDR_APP_ROLE;

-- Grant on schema and tables
GRANT ALL ON SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;
GRANT SELECT ON FUTURE TABLES IN SCHEMA TDR_APP.ML_MODELS TO ROLE TDR_APP_ROLE;

-- =============================================================================
-- 1. TASK: DAILY FEATURE COMPUTATION (6AM UTC)
-- =============================================================================
-- Computes ML features from the Domo-managed opportunitiesmagic table
-- Runs in incremental mode to process only new/changed records
-- =============================================================================

CREATE OR REPLACE TASK TDR_APP.ML_MODELS.TASK_COMPUTE_FEATURES
    WAREHOUSE = TDR_APP_WH
    SCHEDULE = 'USING CRON 0 6 * * * UTC'
    COMMENT = 'Daily feature computation from opportunitiesmagic table (6am UTC)'
    AS
    CALL TDR_APP.ML_MODELS.SP_COMPUTE_ML_FEATURES('INCREMENTAL', 'opportunitiesmagic');

-- Add task tags for monitoring and governance
ALTER TASK TDR_APP.ML_MODELS.TASK_COMPUTE_FEATURES SET
    USER_TASK_TIMEOUT_MS = 3600000,  -- 1 hour timeout
    SUSPEND_TASK_AFTER_NUM_FAILURES = 3;

-- =============================================================================
-- 2. TASK: DAILY BATCH SCORING (7AM UTC)
-- =============================================================================
-- Scores all active opportunities using the latest model
-- Depends on TASK_COMPUTE_FEATURES - will not run until features complete
-- =============================================================================

CREATE OR REPLACE TASK TDR_APP.ML_MODELS.TASK_BATCH_SCORE
    WAREHOUSE = TDR_APP_WH
    AFTER TDR_APP.ML_MODELS.TASK_COMPUTE_FEATURES
    COMMENT = 'Daily batch scoring of opportunities (runs after feature computation)'
    AS
    CALL TDR_APP.ML_MODELS.SP_PREDICT_WIN_PROBABILITY('BATCH', 'LATEST');

-- Configure task behavior
ALTER TASK TDR_APP.ML_MODELS.TASK_BATCH_SCORE SET
    USER_TASK_TIMEOUT_MS = 1800000,  -- 30 minute timeout
    SUSPEND_TASK_AFTER_NUM_FAILURES = 3;

-- =============================================================================
-- 3. TASK: BIWEEKLY MODEL RETRAINING (EVERY 14 DAYS)
-- =============================================================================
-- Retrains the stacking ensemble model with fresh data
-- Uses MEDIUM warehouse for compute-intensive training
-- Auto-generates version based on timestamp
-- =============================================================================

CREATE OR REPLACE TASK TDR_APP.ML_MODELS.TASK_RETRAIN_MODEL
    WAREHOUSE = TDR_ML_TRAINING_WH
    SCHEDULE = 'USING CRON 0 4 1,15 * * UTC'  -- 4am UTC on 1st and 15th of each month
    COMMENT = 'Biweekly model retraining with SMOTE sampling (every ~14 days)'
    AS
    CALL TDR_APP.ML_MODELS.SP_TRAIN_STACKING_ENSEMBLE(
        CONCAT('v', TO_VARCHAR(CURRENT_TIMESTAMP(), 'YYYYMMDD_HH24MISS')),  -- Auto-versioning
        'SMOTE'  -- Use SMOTE for class imbalance handling
    );

-- Configure task for longer-running training workload
ALTER TASK TDR_APP.ML_MODELS.TASK_RETRAIN_MODEL SET
    USER_TASK_TIMEOUT_MS = 14400000,  -- 4 hour timeout for training
    SUSPEND_TASK_AFTER_NUM_FAILURES = 2;

-- =============================================================================
-- 4. ALERT: MODEL PERFORMANCE DEGRADATION (WEEKLY CHECK)
-- =============================================================================
-- Monitors model AUC_ROC and triggers when it falls below 0.65 threshold
-- Logs to ML_ALERT_LOG table for tracking and acknowledgment
-- =============================================================================

CREATE OR REPLACE ALERT TDR_APP.ML_MODELS.ALERT_MODEL_PERFORMANCE_DEGRADATION
    WAREHOUSE = TDR_APP_WH
    SCHEDULE = 'USING CRON 0 8 * * 1 UTC'  -- Weekly on Monday at 8am UTC
    IF (EXISTS (
        SELECT 1
        FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
        WHERE IS_ACTIVE = TRUE
          AND AUC_ROC < 0.65
          AND TRAINED_AT = (
              SELECT MAX(TRAINED_AT)
              FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
              WHERE IS_ACTIVE = TRUE
          )
    ))
    THEN
        INSERT INTO TDR_APP.ML_MODELS.ML_ALERT_LOG (
            ALERT_NAME,
            ALERT_TYPE,
            ALERT_CONDITION,
            CURRENT_VALUE,
            THRESHOLD_VALUE,
            MODEL_VERSION,
            SEVERITY
        )
        SELECT
            'ALERT_MODEL_PERFORMANCE_DEGRADATION',
            'PERFORMANCE_DEGRADATION',
            'AUC_ROC below minimum threshold of 0.65',
            m.AUC_ROC,
            0.65,
            m.MODEL_VERSION,
            CASE
                WHEN m.AUC_ROC < 0.55 THEN 'CRITICAL'
                WHEN m.AUC_ROC < 0.60 THEN 'HIGH'
                ELSE 'WARNING'
            END
        FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA m
        WHERE m.IS_ACTIVE = TRUE
          AND m.AUC_ROC < 0.65
          AND m.TRAINED_AT = (
              SELECT MAX(TRAINED_AT)
              FROM TDR_APP.ML_MODELS.ML_MODEL_METADATA
              WHERE IS_ACTIVE = TRUE
          );

-- =============================================================================
-- 5. STREAM: DEAL PREDICTIONS CHANGE DATA CAPTURE
-- =============================================================================
-- Tracks inserts, updates, and deletes on DEAL_ML_PREDICTIONS
-- Enables downstream processing: Domo sync, UI refresh, notifications
-- =============================================================================

CREATE OR REPLACE STREAM TDR_APP.ML_MODELS.STREAM_DEAL_PREDICTIONS
    ON TABLE TDR_APP.ML_MODELS.DEAL_ML_PREDICTIONS
    APPEND_ONLY = FALSE  -- Track all DML (INSERT, UPDATE, DELETE)
    SHOW_INITIAL_ROWS = FALSE
    COMMENT = 'CDC stream for ML predictions - triggers downstream sync to Domo and UI refresh';

-- =============================================================================
-- OPTIONAL: TASK TO CONSUME STREAM (DOWNSTREAM PROCESSING)
-- =============================================================================
-- Example task that processes new predictions from the stream
-- Customize this based on your downstream requirements
-- =============================================================================

CREATE OR REPLACE TASK TDR_APP.ML_MODELS.TASK_PROCESS_NEW_PREDICTIONS
    WAREHOUSE = TDR_APP_WH
    SCHEDULE = '15 MINUTES'  -- Run every 15 minutes
    WHEN SYSTEM$STREAM_HAS_DATA('TDR_APP.ML_MODELS.STREAM_DEAL_PREDICTIONS')
    COMMENT = 'Processes new predictions from stream for downstream sync'
    AS
    BEGIN
        -- Log new predictions for Domo sync tracking
        INSERT INTO TDR_APP.ML_MODELS.PREDICTION_SYNC_QUEUE (
            PREDICTION_ID,
            OPPORTUNITY_ID,
            WIN_PROBABILITY,
            PREDICTION_CLASS,
            CHANGE_TYPE,
            QUEUED_AT
        )
        SELECT
            PREDICTION_ID,
            OPPORTUNITY_ID,
            WIN_PROBABILITY,
            PREDICTION_CLASS,
            CASE
                WHEN METADATA$ACTION = 'INSERT' THEN 'NEW'
                WHEN METADATA$ACTION = 'DELETE' AND METADATA$ISUPDATE THEN 'UPDATE'
                WHEN METADATA$ACTION = 'DELETE' THEN 'DELETE'
                ELSE 'UNKNOWN'
            END,
            CURRENT_TIMESTAMP()
        FROM TDR_APP.ML_MODELS.STREAM_DEAL_PREDICTIONS;
    END;

-- Create the sync queue table if using the stream processor task
CREATE TABLE IF NOT EXISTS TDR_APP.ML_MODELS.PREDICTION_SYNC_QUEUE (
    SYNC_ID             VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    PREDICTION_ID       VARCHAR(36) NOT NULL,
    OPPORTUNITY_ID      VARCHAR(50) NOT NULL,
    WIN_PROBABILITY     FLOAT,
    PREDICTION_CLASS    VARCHAR(20),
    CHANGE_TYPE         VARCHAR(20),
    QUEUED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    SYNCED_TO_DOMO      BOOLEAN DEFAULT FALSE,
    SYNCED_AT           TIMESTAMP_NTZ,
    SYNC_ERROR          VARCHAR(1000)
)
COMMENT = 'Queue table for predictions awaiting Domo sync';

-- =============================================================================
-- RESUME ALL TASKS AND ALERT
-- =============================================================================
-- Tasks are created in suspended state by default
-- Execute these statements to activate the automation pipeline
-- =============================================================================

-- Resume root task first (TASK_COMPUTE_FEATURES)
ALTER TASK TDR_APP.ML_MODELS.TASK_COMPUTE_FEATURES RESUME;

-- Resume dependent task (will auto-activate when root runs)
ALTER TASK TDR_APP.ML_MODELS.TASK_BATCH_SCORE RESUME;

-- Resume independent retraining task
ALTER TASK TDR_APP.ML_MODELS.TASK_RETRAIN_MODEL RESUME;

-- Resume stream processor task (optional)
ALTER TASK TDR_APP.ML_MODELS.TASK_PROCESS_NEW_PREDICTIONS RESUME;

-- Resume alert
ALTER ALERT TDR_APP.ML_MODELS.ALERT_MODEL_PERFORMANCE_DEGRADATION RESUME;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- View all tasks in the schema
-- SELECT * FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY())
-- WHERE SCHEMA_NAME = 'ML_MODELS'
-- ORDER BY SCHEDULED_TIME DESC;

-- View task dependencies (DAG)
-- SHOW TASKS IN SCHEMA TDR_APP.ML_MODELS;

-- Check task status
-- SELECT NAME, STATE, SCHEDULE, LAST_COMMITTED_ON
-- FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(
--     SCHEDULED_TIME_RANGE_START => DATEADD('day', -1, CURRENT_TIMESTAMP()),
--     RESULT_LIMIT => 10
-- ));

-- View stream status
-- SHOW STREAMS IN SCHEMA TDR_APP.ML_MODELS;

-- Check alert history
-- SELECT * FROM TDR_APP.ML_MODELS.ML_ALERT_LOG ORDER BY TRIGGERED_AT DESC LIMIT 10;

-- =============================================================================
-- MANAGEMENT COMMANDS (REFERENCE)
-- =============================================================================

-- Suspend all tasks (for maintenance)
-- ALTER TASK TDR_APP.ML_MODELS.TASK_BATCH_SCORE SUSPEND;
-- ALTER TASK TDR_APP.ML_MODELS.TASK_COMPUTE_FEATURES SUSPEND;
-- ALTER TASK TDR_APP.ML_MODELS.TASK_RETRAIN_MODEL SUSPEND;
-- ALTER TASK TDR_APP.ML_MODELS.TASK_PROCESS_NEW_PREDICTIONS SUSPEND;
-- ALTER ALERT TDR_APP.ML_MODELS.ALERT_MODEL_PERFORMANCE_DEGRADATION SUSPEND;

-- Manually execute a task (for testing)
-- EXECUTE TASK TDR_APP.ML_MODELS.TASK_COMPUTE_FEATURES;

-- View task run history
-- SELECT *
-- FROM TABLE(TDR_APP.INFORMATION_SCHEMA.TASK_HISTORY(
--     TASK_NAME => 'TASK_COMPUTE_FEATURES',
--     SCHEDULED_TIME_RANGE_START => DATEADD('day', -7, CURRENT_TIMESTAMP())
-- ));
