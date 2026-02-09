-- =============================================================================
-- TDR Deal Inspection — Snowflake Bootstrap DDL
-- =============================================================================
-- Run this script as ACCOUNTADMIN (or a role with CREATE DATABASE privileges).
-- It creates everything needed for the TDR app's Snowflake persistence layer.
--
-- Usage:
--   1. Connect to Snowflake as ACCOUNTADMIN
--   2. Run this entire script
--   3. Verify with: SELECT COUNT(*) FROM TDR_APP.TDR_DATA.TDR_STEP_DEFINITIONS;
--      (should return 9 — the v1 step definitions)
--
-- Alternatively, via Cortex Code CLI:
--   cortex
--   > "Run this SQL script to bootstrap the TDR app database"
-- =============================================================================

-- ─── 1. Database & Schema ────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS TDR_APP
  COMMENT = 'TDR Deal Inspection — Snowflake persistence layer';

CREATE SCHEMA IF NOT EXISTS TDR_APP.TDR_DATA
  COMMENT = 'All TDR app tables live here';

-- ─── 2. Warehouse ────────────────────────────────────────────────────────────

CREATE WAREHOUSE IF NOT EXISTS TDR_APP_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE
  COMMENT = 'TDR app workload — XS is sufficient for transactional reads/writes';

-- ─── 3. Role ─────────────────────────────────────────────────────────────────

CREATE ROLE IF NOT EXISTS TDR_APP_ROLE
  COMMENT = 'Service role for TDR app Code Engine functions';

-- Grant role to SYSADMIN so it inherits into the role hierarchy
GRANT ROLE TDR_APP_ROLE TO ROLE SYSADMIN;

-- ─── 4. Grants ───────────────────────────────────────────────────────────────

-- Database
GRANT USAGE ON DATABASE TDR_APP TO ROLE TDR_APP_ROLE;

-- Schema
GRANT USAGE ON SCHEMA TDR_APP.TDR_DATA TO ROLE TDR_APP_ROLE;
GRANT CREATE TABLE ON SCHEMA TDR_APP.TDR_DATA TO ROLE TDR_APP_ROLE;

-- Warehouse
GRANT USAGE ON WAREHOUSE TDR_APP_WH TO ROLE TDR_APP_ROLE;

-- Cortex AI access (required for AI_COMPLETE, AI_CLASSIFY, etc.)
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE TDR_APP_ROLE;

-- Future tables: auto-grant to TDR_APP_ROLE
GRANT ALL ON FUTURE TABLES IN SCHEMA TDR_APP.TDR_DATA TO ROLE TDR_APP_ROLE;

-- ─── 5. Set context ──────────────────────────────────────────────────────────

USE DATABASE TDR_APP;
USE SCHEMA TDR_DATA;
USE WAREHOUSE TDR_APP_WH;

-- ─── 6. Tables ───────────────────────────────────────────────────────────────

-- Table 1: TDR_SESSIONS
CREATE TABLE IF NOT EXISTS TDR_SESSIONS (
  SESSION_ID           VARCHAR PRIMARY KEY,     -- UUID generated client-side
  OPPORTUNITY_ID       VARCHAR NOT NULL,        -- SFDC Opportunity Id
  OPPORTUNITY_NAME     VARCHAR,
  ACCOUNT_NAME         VARCHAR,
  ACV                  NUMBER(12,2),
  STAGE                VARCHAR,
  STATUS               VARCHAR,                 -- 'in-progress' | 'completed'
  OUTCOME              VARCHAR,                 -- 'approved' | 'needs-work' | 'deferred' | 'at-risk'
  OWNER                VARCHAR,                 -- AE who owns the deal
  CREATED_BY           VARCHAR,                 -- Domo user who initiated
  ITERATION            INTEGER DEFAULT 1,       -- Which TDR pass (1st, 2nd, etc.)
  STEP_SCHEMA_VERSION  VARCHAR DEFAULT 'v1',    -- Which TDR step definition was active
  NOTES                VARCHAR,                 -- Free-form notes
  COMPLETED_STEPS      VARIANT,                 -- JSON array of completed step IDs
  CREATED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  UPDATED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Table 2: TDR_STEP_INPUTS
CREATE TABLE IF NOT EXISTS TDR_STEP_INPUTS (
  INPUT_ID           VARCHAR PRIMARY KEY,     -- UUID
  SESSION_ID         VARCHAR NOT NULL,        -- FK → TDR_SESSIONS
  OPPORTUNITY_ID     VARCHAR NOT NULL,
  STEP_ID            VARCHAR NOT NULL,        -- 'context' | 'decision' | 'current-arch' | ...
  STEP_LABEL         VARCHAR,                 -- 'Deal Context & Stakes' (human-readable)
  FIELD_ID           VARCHAR NOT NULL,        -- 'strategic-value' | 'business-impact' | ...
  FIELD_LABEL        VARCHAR,                 -- 'Strategic Value' (human-readable)
  FIELD_VALUE        VARCHAR,                 -- The user's input
  STEP_ORDER         INTEGER,                 -- Position of this step in the process (1-based)
  SAVED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  SAVED_BY           VARCHAR
);

-- Table 3: TDR_STEP_DEFINITIONS
CREATE TABLE IF NOT EXISTS TDR_STEP_DEFINITIONS (
  SCHEMA_VERSION     VARCHAR NOT NULL,        -- 'v1', 'v2', etc.
  STEP_ID            VARCHAR NOT NULL,        -- 'context' | 'decision' | 'current-arch' | ...
  STEP_TITLE         VARCHAR NOT NULL,        -- 'Deal Context & Stakes'
  STEP_DESCRIPTION   VARCHAR,                 -- 'Strategic importance and business impact'
  STEP_ORDER         INTEGER NOT NULL,        -- Position in the process (1-based)
  FIELDS             VARIANT,                 -- JSON array of { id, label, type, required }
  IS_ACTIVE          BOOLEAN DEFAULT TRUE,    -- FALSE if step was removed in this version
  CREATED_AT         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (SCHEMA_VERSION, STEP_ID)
);

-- Table 4: TDR_CHAT_MESSAGES
CREATE TABLE IF NOT EXISTS TDR_CHAT_MESSAGES (
  MESSAGE_ID          VARCHAR(36) PRIMARY KEY,
  SESSION_ID          VARCHAR(36) NOT NULL,
  OPPORTUNITY_ID      VARCHAR(18) NOT NULL,
  ACCOUNT_NAME        VARCHAR(255),
  ROLE                VARCHAR(10) NOT NULL,     -- 'user' | 'assistant'
  CONTENT             VARCHAR NOT NULL,
  CONTEXT_STEP        VARCHAR(50),
  PROVIDER            VARCHAR(30),              -- 'cortex' | 'perplexity' | 'domo'
  MODEL_USED          VARCHAR(50),
  TOKENS_IN           INTEGER,
  TOKENS_OUT          INTEGER,
  CITED_SOURCES       VARIANT,                  -- JSON array of citation URLs
  CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  CREATED_BY          VARCHAR(100)
);

-- Table 5: ACCOUNT_INTEL_SUMBLE
CREATE TABLE IF NOT EXISTS ACCOUNT_INTEL_SUMBLE (
  PULL_ID            VARCHAR PRIMARY KEY,
  OPPORTUNITY_ID     VARCHAR NOT NULL,
  ACCOUNT_NAME       VARCHAR NOT NULL,
  ACCOUNT_DOMAIN     VARCHAR,
  INDUSTRY           VARCHAR,
  SUB_INDUSTRY       VARCHAR,
  EMPLOYEE_COUNT     INTEGER,
  REVENUE            NUMBER(14,2),
  HEADQUARTERS       VARCHAR,
  TECHNOLOGIES       VARIANT,                   -- JSON array
  TECH_CATEGORIES    VARIANT,                   -- JSON obj
  RAW_RESPONSE       VARIANT,
  PULLED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PULLED_BY          VARCHAR
);

-- Table 6: ACCOUNT_INTEL_PERPLEXITY
CREATE TABLE IF NOT EXISTS ACCOUNT_INTEL_PERPLEXITY (
  PULL_ID             VARCHAR PRIMARY KEY,
  OPPORTUNITY_ID      VARCHAR NOT NULL,
  ACCOUNT_NAME        VARCHAR NOT NULL,
  SEARCH_CONTEXT      VARCHAR,
  SUMMARY             VARCHAR,
  RECENT_INITIATIVES  VARIANT,
  TECHNOLOGY_SIGNALS  VARIANT,
  COMPETITIVE_LANDSCAPE VARIANT,
  KEY_INSIGHTS        VARIANT,
  CITATIONS           VARIANT,
  RAW_RESPONSE        VARIANT,
  PULLED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  PULLED_BY           VARCHAR
);

-- Table 7: API_USAGE_LOG
CREATE TABLE IF NOT EXISTS API_USAGE_LOG (
  LOG_ID              VARCHAR PRIMARY KEY,
  SERVICE             VARCHAR NOT NULL,          -- 'perplexity' | 'sumble' | 'cortex'
  ACTION              VARCHAR,
  OPPORTUNITY_ID      VARCHAR,
  ACCOUNT_NAME        VARCHAR,
  TOKENS_IN           INTEGER,
  TOKENS_OUT          INTEGER,
  DURATION_MS         INTEGER,
  STATUS              VARCHAR,                   -- 'success' | 'error' | 'rate_limited'
  ERROR_MESSAGE       VARCHAR,
  CALLED_AT           TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  CALLED_BY           VARCHAR
);

-- Table 8: CORTEX_ANALYSIS_RESULTS
CREATE TABLE IF NOT EXISTS CORTEX_ANALYSIS_RESULTS (
  RESULT_ID           VARCHAR PRIMARY KEY,
  ANALYSIS_TYPE       VARCHAR NOT NULL,
  OPPORTUNITY_ID      VARCHAR,
  SESSION_ID          VARCHAR,
  SCOPE               VARCHAR,
  INPUT_CONTEXT       VARCHAR,
  OUTPUT              VARIANT,
  MODEL_USED          VARCHAR,
  CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  CREATED_BY          VARCHAR
);

-- Table 9: DEAL_EMBEDDINGS (for semantic search — Sprint 6+)
CREATE TABLE IF NOT EXISTS DEAL_EMBEDDINGS (
  EMBEDDING_ID        VARCHAR PRIMARY KEY,
  OPPORTUNITY_ID      VARCHAR NOT NULL,
  SESSION_ID          VARCHAR,
  SOURCE_TYPE         VARCHAR,                   -- 'tdr_inputs' | 'intel_sumble' | 'intel_perplexity'
  SOURCE_TEXT          VARCHAR,                   -- The text that was embedded
  EMBEDDING           VECTOR(FLOAT, 1024),       -- Cortex AI_EMBED output
  CREATED_AT          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Table 10: TDR_READOUTS — tracks every generated PDF readout (Sprint 13)
CREATE TABLE IF NOT EXISTS TDR_READOUTS (
  READOUT_ID          VARCHAR(36) PRIMARY KEY,
  SESSION_ID          VARCHAR(36) NOT NULL,     -- FK → TDR_SESSIONS
  OPPORTUNITY_ID      VARCHAR(18) NOT NULL,
  ACCOUNT_NAME        VARCHAR(255),
  SECTIONS_INCLUDED   VARIANT,                  -- JSON array of section IDs that had data
  SECTIONS_EMPTY      VARIANT,                  -- JSON array of section IDs with no data
  EXECUTIVE_SUMMARY   VARCHAR,                  -- Cached AI summary
  TOTAL_PAGES         INTEGER,
  FILE_SIZE_BYTES     INTEGER,
  FILE_HASH           VARCHAR(64),              -- SHA-256 for integrity verification
  THEME_CONFIG        VARIANT,                  -- JSON of theme settings used
  GENERATED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  GENERATED_BY        VARCHAR(100)
);

-- Table 11: TDR_DISTRIBUTIONS — tracks distribution events (Sprint 14)
CREATE TABLE IF NOT EXISTS TDR_DISTRIBUTIONS (
  DISTRIBUTION_ID     VARCHAR(36) PRIMARY KEY,
  READOUT_ID          VARCHAR(36) NOT NULL,     -- FK → TDR_READOUTS
  SESSION_ID          VARCHAR(36) NOT NULL,
  METHOD              VARCHAR(20) NOT NULL,     -- 'download' | 'slack' | 'email'
  CHANNEL             VARCHAR(255),             -- Slack channel name/ID, email address, or 'local'
  RECIPIENT           VARCHAR(255),             -- Who received it
  SUMMARY_SENT        VARCHAR,                  -- The executive summary that was sent
  STATUS              VARCHAR(20),              -- 'success' | 'failed' | 'pending'
  ERROR_MESSAGE       VARCHAR,
  DISTRIBUTED_AT      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  DISTRIBUTED_BY      VARCHAR(100)
);

-- ─── 7. Grant on existing tables ─────────────────────────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA TDR_APP.TDR_DATA TO ROLE TDR_APP_ROLE;

-- ─── 8. Seed TDR_STEP_DEFINITIONS (v1 — current 9-step process) ─────────────

INSERT INTO TDR_STEP_DEFINITIONS (SCHEMA_VERSION, STEP_ID, STEP_TITLE, STEP_DESCRIPTION, STEP_ORDER, FIELDS)
SELECT 'v1', col.STEP_ID, col.STEP_TITLE, col.STEP_DESCRIPTION, col.STEP_ORDER, col.FIELDS
FROM (
  SELECT 'context'      AS STEP_ID, 'Deal Context & Stakes'    AS STEP_TITLE, 'Strategic importance and business impact'    AS STEP_DESCRIPTION, 1 AS STEP_ORDER,
    PARSE_JSON('[{"id":"strategic-value","label":"Strategic Value","type":"textarea"},{"id":"business-impact","label":"Business Impact","type":"textarea"}]') AS FIELDS
  UNION ALL SELECT 'decision',    'Business Decision',       'What is the customer trying to achieve?',     2, NULL
  UNION ALL SELECT 'current-arch','Current Architecture',     'Existing systems and data landscape',         3, NULL
  UNION ALL SELECT 'target-arch', 'Target Architecture',      'Proposed solution and integration points',    4, NULL
  UNION ALL SELECT 'domo-role',   'Domo Role',                'How Domo fits in the solution',               5, NULL
  UNION ALL SELECT 'partner',     'Partner Alignment',        'SI/Partner involvement and commitment',       6, NULL
  UNION ALL SELECT 'ai-strategy', 'AI Strategy',              'AI/ML use cases and data science needs',      7, NULL
  UNION ALL SELECT 'risk',        'Technical Risk',           'Implementation risks and mitigations',        8, NULL
  UNION ALL SELECT 'usage',       'Usage & Adoption',         'User adoption plan and success metrics',      9, NULL
) AS col
WHERE NOT EXISTS (
  SELECT 1 FROM TDR_STEP_DEFINITIONS WHERE SCHEMA_VERSION = 'v1' AND STEP_ID = col.STEP_ID
);

-- ─── 9. Enable cross-region inference (for Cortex AI models) ─────────────────
-- Uncomment the line matching your Snowflake region:

-- ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_US';
-- ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_EU';
-- ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';

-- ─── 10. Verification queries ────────────────────────────────────────────────

-- Run these to confirm everything was created:

-- SELECT TABLE_NAME, ROW_COUNT
-- FROM INFORMATION_SCHEMA.TABLES
-- WHERE TABLE_SCHEMA = 'TDR_DATA'
-- ORDER BY TABLE_NAME;

-- SELECT * FROM TDR_STEP_DEFINITIONS WHERE SCHEMA_VERSION = 'v1' ORDER BY STEP_ORDER;

-- SELECT CURRENT_TIMESTAMP() AS verification_timestamp;

-- =============================================================================
-- DONE. Next steps:
--   1. Create a Snowflake keypair user for Code Engine (or use an existing one)
--   2. Create a Domo Account of type "Snowflake Keypair" with:
--      - account_url: your Snowflake account URL
--      - username: the service user
--      - private_key: the RSA private key (PEM format)
--   3. Deploy snowflakeAuth.js to a Code Engine function in Domo
--   4. Test with a simple SELECT from Code Engine
-- =============================================================================

