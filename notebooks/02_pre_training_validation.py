"""
02 — Pre-Training Data Validation
Sprint 28b+ · TDR Deal Inspection App

Run this BEFORE model training (Sprint 28c). It validates data quality
on the live Snowflake dataset and produces a clean, leakage-free feature
list. Training should not proceed until all critical checks pass.

Usage:
    python notebooks/02_pre_training_validation.py

Requires: snowflake-connector-python, pandas, numpy
"""

import os
import sys
import json
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np

# ── Snowflake connection ─────────────────────────────────────────────
try:
    import snowflake.connector
except ImportError:
    print("ERROR: snowflake-connector-python not installed.")
    print("  pip install snowflake-connector-python")
    sys.exit(1)

TABLE = 'TDR_APP.PUBLIC."Forecast_Page_Opportunities_Magic_SNFv2"'
OPPORTUNITY_ID_COL = "Opportunity Id"
IS_CLOSED_COL = "Is Closed"
IS_WON_COL = "Is Won"
STAGE_COL = "Stage"
ACV_COL = "ACV (USD)"
STAGE_AGE_COL = "Stage Age"
CREATED_DATE_COL = "Created Date"
CLOSE_DATE_COL = "Close Date"

# Features that MUST NOT be used for training — they reveal the outcome
LEAKAGE_FEATURES = {
    # Direct label leakage
    "Is Won", "Is Closed", "Is Pipeline",

    # Post-outcome timestamps (only populated after deal closes)
    "StageDate Closed Won", "StageDate Closed Lost",

    # Outcome-derived aggregates on the SAME deal
    "Domo Forecast Category",  # Often set to "Closed" after the fact

    # Fields that encode the final stage
    "Stage",  # "Closed Won" / "Closed Lost" IS the label

    # Identifiers (not features — overfit to specific deals/people)
    "Opportunity Id", "Opportunity Name", "Account Id",
    "Domo Opportunity Owner", "Forecast Manager",
    "Sales Consultant", "PoC Sales Consultant", "Lead SC",

    # Metadata / system fields
    "Last Modified Date", "Last Modified By",
    "Opportunity Record Link",
}

# Features that are borderline — flag for review but don't auto-exclude
BORDERLINE_FEATURES = {
    "Last Activity Date": "Could reflect post-close activity",
    "Forecast Comments": "May contain 'closed' / 'won' / 'lost' language",
    "Next Step": "May contain 'closed' / 'won' / 'lost' language",
    "Stage Age": "Resets at close — check if value reflects pre-close age",
    "Number of Competitors": "Usually set pre-close, but verify",
}

RESULTS = {
    "timestamp": datetime.now().isoformat(),
    "checks": {},
    "critical_failures": [],
    "warnings": [],
    "clean_features": [],
}


def connect():
    """Connect to Snowflake using ~/.snowflake/connections.toml (same as EDA notebook)."""
    from pathlib import Path
    try:
        import toml
    except ImportError:
        print("ERROR: toml not installed. Run: pip install toml")
        sys.exit(1)

    toml_path = Path.home() / ".snowflake" / "connections.toml"
    if not toml_path.exists():
        print(f"ERROR: {toml_path} not found.")
        print("  Create it or set SNOWFLAKE_ACCOUNT/USER/PASSWORD env vars.")
        sys.exit(1)

    config = toml.load(toml_path)
    conn_name = "default" if "default" in config else list(config.keys())[0]
    cfg = config[conn_name]

    print(f"  Connection: {conn_name}")
    print(f"  Account:    {cfg.get('account', '?')}")
    print(f"  User:       {cfg.get('user', '?')}")
    print(f"  Auth:       {cfg.get('authenticator', 'snowflake')}")

    return snowflake.connector.connect(
        account=cfg["account"],
        user=cfg["user"],
        authenticator=cfg.get("authenticator", "snowflake"),
        database=cfg.get("database", "TDR_APP"),
        schema=cfg.get("schema", "PUBLIC"),
        warehouse=cfg.get("warehouse", "TDR_APP_WH"),
        role=cfg.get("role", None),
    )


def section(title):
    print(f"\n{'─' * 70}")
    print(f"  {title}")
    print(f"{'─' * 70}")


def check_pass(name, detail=""):
    RESULTS["checks"][name] = "PASS"
    print(f"  ✅ {name}" + (f" — {detail}" if detail else ""))


def check_fail(name, detail=""):
    RESULTS["checks"][name] = "FAIL"
    RESULTS["critical_failures"].append(f"{name}: {detail}")
    print(f"  ❌ {name}" + (f" — {detail}" if detail else ""))


def check_warn(name, detail=""):
    RESULTS["checks"][name] = "WARN"
    RESULTS["warnings"].append(f"{name}: {detail}")
    print(f"  ⚠️  {name}" + (f" — {detail}" if detail else ""))


# ═══════════════════════════════════════════════════════════════════════
#  CHECK 1: DEDUPLICATION
# ═══════════════════════════════════════════════════════════════════════
def check_deduplication(cur):
    section("CHECK 1: Deduplication")

    cur.execute(f"""
        SELECT COUNT(*) as total_rows,
               COUNT(DISTINCT "{OPPORTUNITY_ID_COL}") as unique_ids
        FROM {TABLE}
        WHERE "{IS_CLOSED_COL}" = 'true'
    """)
    total, unique = cur.fetchone()
    dup_count = total - unique
    dup_pct = (dup_count / total * 100) if total > 0 else 0

    print(f"  Total closed rows:     {total:,}")
    print(f"  Unique Opportunity IDs: {unique:,}")
    print(f"  Duplicate rows:        {dup_count:,} ({dup_pct:.1f}%)")

    if dup_count == 0:
        check_pass("No duplicate Opportunity IDs in closed deals")
    elif dup_pct < 1:
        check_warn("Duplicates exist but < 1%",
                    f"{dup_count:,} duplicates — deduplicate in training view")
    else:
        check_fail("Significant duplicates detected",
                   f"{dup_count:,} duplicates ({dup_pct:.1f}%) — MUST deduplicate before training")

    if dup_count > 0:
        cur.execute(f"""
            SELECT "{OPPORTUNITY_ID_COL}", COUNT(*) as cnt
            FROM {TABLE}
            WHERE "{IS_CLOSED_COL}" = 'true'
            GROUP BY "{OPPORTUNITY_ID_COL}"
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 10
        """)
        top_dups = cur.fetchall()
        print(f"\n  Top duplicated IDs (showing up to 10):")
        for opp_id, cnt in top_dups:
            print(f"    {opp_id}: {cnt} rows")

    return dup_count, unique


# ═══════════════════════════════════════════════════════════════════════
#  CHECK 2: LABEL / STAGE CONSISTENCY
# ═══════════════════════════════════════════════════════════════════════
def check_label_stage_consistency(cur):
    section("CHECK 2: Label / Stage Consistency")

    cur.execute(f"""
        SELECT "{STAGE_COL}",
               "{IS_WON_COL}",
               "{IS_CLOSED_COL}",
               COUNT(*) as cnt
        FROM {TABLE}
        WHERE "{IS_CLOSED_COL}" = 'true'
        GROUP BY "{STAGE_COL}", "{IS_WON_COL}", "{IS_CLOSED_COL}"
        ORDER BY cnt DESC
    """)
    rows = cur.fetchall()
    print(f"  Stage × IsWon × IsClosed combinations (closed deals only):")
    print(f"  {'Stage':<30s} {'IsWon':>8s} {'IsClosed':>10s} {'Count':>10s}")
    mismatches = 0
    for stage, is_won, is_closed, cnt in rows:
        flag = ""
        if is_won == "true" and stage and "Lost" in str(stage):
            flag = " ← MISMATCH"
            mismatches += cnt
        if is_won == "false" and stage and "Won" in str(stage):
            flag = " ← MISMATCH"
            mismatches += cnt
        print(f"  {str(stage):<30s} {str(is_won):>8s} {str(is_closed):>10s} {cnt:>10,}{flag}")

    if mismatches == 0:
        check_pass("Labels align with Stage values")
    else:
        check_fail("Stage/label mismatches detected",
                   f"{mismatches:,} deals where Stage contradicts Is Won")

    # Check for null labels
    cur.execute(f"""
        SELECT COUNT(*) FROM {TABLE}
        WHERE "{IS_CLOSED_COL}" = 'true'
          AND ("{IS_WON_COL}" IS NULL OR "{IS_WON_COL}" = '')
    """)
    null_labels = cur.fetchone()[0]
    if null_labels == 0:
        check_pass("No null/empty labels in closed deals")
    else:
        check_fail("Null labels in closed deals",
                   f"{null_labels:,} closed deals with null/empty Is Won")

    return mismatches


# ═══════════════════════════════════════════════════════════════════════
#  CHECK 3: TARGET LEAKAGE AUDIT
# ═══════════════════════════════════════════════════════════════════════
def check_target_leakage(cur):
    section("CHECK 3: Target Leakage Audit")

    cur.execute(f"SELECT * FROM {TABLE} LIMIT 0")
    all_columns = {desc[0] for desc in cur.description}

    leakage_found = LEAKAGE_FEATURES & all_columns
    borderline_found = {k: v for k, v in BORDERLINE_FEATURES.items() if k in all_columns}

    print(f"  Columns flagged as LEAKAGE (auto-excluded from training):")
    for col in sorted(leakage_found):
        print(f"    🚫 {col}")

    print(f"\n  Columns flagged as BORDERLINE (review before including):")
    for col, reason in sorted(borderline_found.items()):
        print(f"    ⚠️  {col} — {reason}")

    safe_candidates = all_columns - LEAKAGE_FEATURES - set(BORDERLINE_FEATURES.keys())
    print(f"\n  Total columns in dataset:     {len(all_columns)}")
    print(f"  Leakage (auto-excluded):      {len(leakage_found)}")
    print(f"  Borderline (review needed):   {len(borderline_found)}")
    print(f"  Safe candidate pool:          {len(safe_candidates)}")

    check_pass("Leakage features identified and excluded",
               f"{len(leakage_found)} columns will be excluded from ML_FEATURE_STORE")

    return leakage_found, borderline_found, safe_candidates


# ═══════════════════════════════════════════════════════════════════════
#  CHECK 4: OUTLIER PROFILING
# ═══════════════════════════════════════════════════════════════════════
def check_outliers(cur):
    section("CHECK 4: Outlier Profiling (key numeric features)")

    numeric_cols = [
        (ACV_COL, "ACV"),
        (STAGE_AGE_COL, "Stage Age"),
        ("Account Revenue USD", "Account Revenue"),
        ("Account Employees", "Employees"),
        ("Platform Price", "Platform Price"),
        ("Professional Services Price", "Prof Services"),
        ("Line Items", "Line Items"),
        ("Total Closed Won Count", "Won Count"),
        ("Total Closed Lost Count", "Lost Count"),
    ]

    print(f"  {'Feature':<25s} {'Min':>12s} {'P5':>12s} {'Median':>12s} {'P95':>12s} {'Max':>12s} {'Outliers':>10s}")
    print(f"  {'─' * 97}")

    for col, label in numeric_cols:
        try:
            cur.execute(f"""
                SELECT
                    MIN("{col}"),
                    PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY "{col}"),
                    MEDIAN("{col}"),
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "{col}"),
                    MAX("{col}"),
                    COUNT(*)
                FROM {TABLE}
                WHERE "{IS_CLOSED_COL}" = 'true' AND "{col}" IS NOT NULL
            """)
            mn, p5, med, p95, mx, cnt = cur.fetchone()
            if mn is None:
                print(f"  {label:<25s} — all null")
                continue

            iqr = float(p95 - p5) if p95 and p5 else 0
            lower = float(p5) - 1.5 * iqr
            upper = float(p95) + 1.5 * iqr

            cur.execute(f"""
                SELECT COUNT(*) FROM {TABLE}
                WHERE "{IS_CLOSED_COL}" = 'true'
                  AND "{col}" IS NOT NULL
                  AND ("{col}" < {lower} OR "{col}" > {upper})
            """)
            outlier_count = cur.fetchone()[0]
            outlier_pct = outlier_count / cnt * 100 if cnt > 0 else 0

            def fmt(v):
                if v is None:
                    return "null"
                v = float(v)
                if abs(v) >= 1_000_000:
                    return f"{v / 1_000_000:.1f}M"
                if abs(v) >= 1_000:
                    return f"{v / 1_000:.1f}K"
                return f"{v:.1f}"

            print(f"  {label:<25s} {fmt(mn):>12s} {fmt(p5):>12s} {fmt(med):>12s} {fmt(p95):>12s} {fmt(mx):>12s} {outlier_pct:>9.1f}%")

            if outlier_pct > 10:
                check_warn(f"High outlier rate: {label}", f"{outlier_pct:.1f}% — consider winsorizing or log-transform")
        except Exception as e:
            print(f"  {label:<25s} — error: {e}")

    check_pass("Outlier profiling complete — review above for winsorization candidates")


# ═══════════════════════════════════════════════════════════════════════
#  CHECK 5: TEMPORAL DISTRIBUTION
# ═══════════════════════════════════════════════════════════════════════
def check_temporal_distribution(cur):
    section("CHECK 5: Temporal Distribution")

    cur.execute(f"""
        SELECT
            "Close Date FQ" as quarter,
            COUNT(*) as total,
            SUM(CASE WHEN "{IS_WON_COL}" = 'true' THEN 1 ELSE 0 END) as won,
            SUM(CASE WHEN "{IS_WON_COL}" = 'false' THEN 1 ELSE 0 END) as lost,
            ROUND(SUM(CASE WHEN "{IS_WON_COL}" = 'true' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as win_rate
        FROM {TABLE}
        WHERE "{IS_CLOSED_COL}" = 'true'
          AND "Close Date FQ" IS NOT NULL
        GROUP BY "Close Date FQ"
        ORDER BY "Close Date FQ" DESC
        LIMIT 20
    """)
    rows = cur.fetchall()

    print(f"  {'Quarter':<12s} {'Total':>8s} {'Won':>8s} {'Lost':>8s} {'Win Rate':>10s}")
    print(f"  {'─' * 50}")
    for qtr, total, won, lost, wr in rows:
        print(f"  {str(qtr):<12s} {total:>8,} {won:>8,} {lost:>8,} {wr:>9.1f}%")

    # Check for severe win rate drift over time
    if len(rows) >= 4:
        recent_wr = np.mean([r[4] for r in rows[:4] if r[4] is not None])
        older_wr = np.mean([r[4] for r in rows[-4:] if r[4] is not None])
        drift = abs(recent_wr - older_wr)
        if drift > 15:
            check_warn("Win rate drift detected",
                       f"Recent 4Q avg: {recent_wr:.1f}% vs older 4Q avg: {older_wr:.1f}% (Δ{drift:.1f}pp) — consider time-based train/test split")
        else:
            check_pass("Win rate relatively stable across quarters",
                       f"Recent: {recent_wr:.1f}% vs older: {older_wr:.1f}%")

    # Recommendation for train/test split
    if len(rows) >= 2:
        latest_qtr = rows[0][0]
        print(f"\n  Recommendation: Hold out {latest_qtr} as test set (temporal split)")
        print(f"  Train on everything before {latest_qtr}, test on {latest_qtr}")

    return rows


# ═══════════════════════════════════════════════════════════════════════
#  CHECK 6: CATEGORICAL CARDINALITY
# ═══════════════════════════════════════════════════════════════════════
def check_cardinality(cur):
    section("CHECK 6: Categorical Cardinality")

    cat_cols = [
        "Type", "Record Type", "Deal Code", "Contract Type", "Pricing Type",
        "Region", "Sales Segment", "Sales Vertical", "Account Type",
        "Account Category", "Customer Type", "Lead Source", "Key Lead Source",
        "Partner Influence", "Business Challenge", "Team", "Sub-Team",
        "People AI Engagement Level", "Account Status",
    ]

    print(f"  {'Feature':<35s} {'Cardinality':>12s} {'Risk':>8s}")
    print(f"  {'─' * 58}")

    high_card = []
    for col in cat_cols:
        try:
            cur.execute(f"""
                SELECT COUNT(DISTINCT "{col}") FROM {TABLE}
                WHERE "{IS_CLOSED_COL}" = 'true' AND "{col}" IS NOT NULL
            """)
            card = cur.fetchone()[0]
            risk = "HIGH" if card > 50 else "MED" if card > 20 else "LOW"
            print(f"  {col:<35s} {card:>12,} {risk:>8s}")
            if card > 50:
                high_card.append((col, card))
        except Exception:
            print(f"  {col:<35s} {'—':>12s} {'—':>8s}")

    if high_card:
        check_warn("High-cardinality categoricals detected",
                   f"{len(high_card)} features with >50 unique values — consider grouping or excluding")
        for col, card in high_card:
            print(f"    → {col}: {card} unique values")
    else:
        check_pass("All categorical features have manageable cardinality")


# ═══════════════════════════════════════════════════════════════════════
#  CHECK 7: SAFE FEATURE LIST
# ═══════════════════════════════════════════════════════════════════════
def produce_safe_feature_list(safe_candidates):
    section("CHECK 7: Safe Feature List for ML_FEATURE_STORE")

    # Features we actually want for the model (from shaping doc, minus leakage)
    DESIRED_FEATURES = [
        # Deal economics
        "ACV (USD)", "ACV (USD) Recurring", "ACV (USD) Non-Recurring",
        "TCV (USD)", "Platform Price", "Professional Services Price",
        "Line Items",

        # Deal characteristics
        "Type", "Deal Code", "Contract Type", "Pricing Type", "CPQ",
        "Non-Competitive Deal", "Number of Competitors",

        # Account firmographics
        "Account Revenue USD", "Account Employees",
        "Strategic Account", "Region", "Sales Segment", "Sales Vertical",

        # Account history
        "Total Closed Won Count", "Total Closed Lost Count",
        "New Logo Won Count", "New Logo Lost Count",
        "Upsell Won Count", "Upsell Lost Count",
        "Total Opty Count",

        # Engagement
        "People AI Engagement Level",

        # Sales process milestones (available pre-close)
        "Discovery Call Completed", "Demo Completed Date",
        "Pricing Call Date", "Gate Call Completed",
        "Has Pre-Call Plan", "Has ADM/AE Sync Agenda",

        # Partner
        "Partner Influence", "Is Partner",

        # Timing (for derived features)
        "Created Date", "Close Date", "Stage Age",

        # Lead
        "Lead Source",
    ]

    safe_list = [f for f in DESIRED_FEATURES if f in safe_candidates]
    excluded = [f for f in DESIRED_FEATURES if f not in safe_candidates]

    print(f"  Desired features:   {len(DESIRED_FEATURES)}")
    print(f"  Available & safe:   {len(safe_list)}")
    print(f"  Excluded (leakage): {len(excluded)}")

    if excluded:
        print(f"\n  Excluded from desired list (leakage/borderline):")
        for f in excluded:
            reason = "leakage" if f in LEAKAGE_FEATURES else "borderline"
            print(f"    🚫 {f} ({reason})")

    print(f"\n  ✅ Safe feature list ({len(safe_list)} features):")
    for f in safe_list:
        print(f"    ✓ {f}")

    RESULTS["clean_features"] = safe_list
    return safe_list


# ═══════════════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════════════
def print_summary():
    section("FINAL VERDICT")

    n_critical = len(RESULTS["critical_failures"])
    n_warnings = len(RESULTS["warnings"])
    n_features = len(RESULTS["clean_features"])

    if n_critical == 0:
        print(f"""
  ✅ ALL CRITICAL CHECKS PASSED

  Clean features:     {n_features}
  Warnings:           {n_warnings}
  Critical failures:  0

  → PROCEED to Sprint 28c: ML_FEATURE_STORE view should use
    the {n_features} safe features listed above.
  → Address warnings before training if possible.
""")
    else:
        print(f"""
  ❌ {n_critical} CRITICAL FAILURE(S) — DO NOT TRAIN

  Clean features:     {n_features}
  Warnings:           {n_warnings}
  Critical failures:  {n_critical}
""")
        for failure in RESULTS["critical_failures"]:
            print(f"    ❌ {failure}")
        print(f"""
  → Fix critical issues before proceeding to Sprint 28c.
  → The ML_TRAINING_DATA view MUST address these issues.
""")

    if n_warnings > 0:
        print(f"  Warnings to address:")
        for w in RESULTS["warnings"]:
            print(f"    ⚠️  {w}")

    # Save results
    out_path = os.path.join(os.path.dirname(__file__), "validation_results.json")
    with open(out_path, "w") as f:
        json.dump(RESULTS, f, indent=2, default=str)
    print(f"\n  Results saved to {out_path}")


# ═══════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════
def main():
    print("=" * 70)
    print("  PRE-TRAINING DATA VALIDATION — Deal Close Propensity")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    conn = connect()
    cur = conn.cursor()

    try:
        check_deduplication(cur)
        check_label_stage_consistency(cur)
        leakage, borderline, safe = check_target_leakage(cur)
        check_outliers(cur)
        check_temporal_distribution(cur)
        check_cardinality(cur)
        produce_safe_feature_list(safe)
        print_summary()
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
