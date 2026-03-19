#!/usr/bin/env python3
"""
Seed the aus_dash Postgres database from data/live-store.json.

Usage:
    python3 scripts/seed-from-store.py [--dry-run]

Requires psql to be available on PATH.
"""

import json
import subprocess
import sys
import os

DB_HOST = "localhost"
DB_PORT = "5433"
DB_USER = "postgres"
DB_PASS = "postgres"
DB_NAME = "aus_dash"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
JSON_PATH = os.path.join(PROJECT_DIR, "data", "live-store.json")


def psql(sql: str) -> str:
    """Run SQL via psql and return stdout."""
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASS
    result = subprocess.run(
        ["psql", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME,
         "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "-t", "-A"],
        input=sql,
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        print(f"psql error:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


def escape_sql(val: str) -> str:
    """Escape a string for SQL single-quote literals."""
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def sql_val(val, typ="text"):
    """Convert a Python value to a SQL literal."""
    if val is None:
        return "NULL"
    if typ == "bool":
        return "TRUE" if val else "FALSE"
    if typ == "numeric":
        return str(val)
    if typ == "timestamptz":
        return escape_sql(str(val))
    return escape_sql(str(val))


def main():
    dry_run = "--dry-run" in sys.argv

    # Check tables exist
    table_check = psql(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'observations';"
    )
    if table_check.strip() == "0":
        print("ERROR: 'observations' table does not exist. Run migrations first.")
        print("  e.g.: cd crates/aus-db && sqlx migrate run")
        sys.exit(1)

    # Load JSON
    with open(JSON_PATH) as f:
        data = json.load(f)

    sources = data.get("sources", [])
    observations = data.get("observations", [])

    print(f"Loaded {len(sources)} sources and {len(observations)} observations from live-store.json")

    # Build SQL
    statements = []

    # --- Sources ---
    for s in sources:
        statements.append(
            f"INSERT INTO sources (source_id, domain, name, url, expected_cadence) "
            f"VALUES ({sql_val(s['sourceId'])}, {sql_val(s['domain'])}, "
            f"{sql_val(s['name'])}, {sql_val(s['url'])}, {sql_val(s['expectedCadence'])}) "
            f"ON CONFLICT (source_id) DO UPDATE SET "
            f"domain = EXCLUDED.domain, name = EXCLUDED.name, "
            f"url = EXCLUDED.url, expected_cadence = EXCLUDED.expected_cadence;"
        )

    # --- Observations ---
    for o in observations:
        cols = [
            "series_id", "region_code", "date", "value", "unit",
            "source_name", "source_url", "published_at", "ingested_at",
            "vintage", "is_modeled", "confidence",
        ]
        vals = [
            sql_val(o["seriesId"]),
            sql_val(o["regionCode"]),
            sql_val(o["date"]),
            sql_val(o["value"], "numeric"),
            sql_val(o["unit"]),
            sql_val(o["sourceName"]),
            sql_val(o["sourceUrl"]),
            sql_val(o["publishedAt"], "timestamptz"),
            sql_val(o["ingestedAt"], "timestamptz"),
            sql_val(o["vintage"]),
            sql_val(o.get("isModeled", False), "bool"),
            sql_val(o["confidence"]),
        ]

        # Optional columns from migration 2
        optional_cols = {
            "country_code": ("countryCode", "text"),
            "market": ("market", "text"),
            "metric_family": ("metricFamily", "text"),
            "interval_start_utc": ("intervalStartUtc", "timestamptz"),
            "interval_end_utc": ("intervalEndUtc", "timestamptz"),
            "currency": ("currency", "text"),
            "tax_status": ("taxStatus", "text"),
            "consumption_band": ("consumptionBand", "text"),
            "methodology_version": ("methodologyVersion", "text"),
        }

        for db_col, (json_key, typ) in optional_cols.items():
            v = o.get(json_key)
            if v is not None:
                cols.append(db_col)
                vals.append(sql_val(v, typ))

        col_str = ", ".join(cols)
        val_str = ", ".join(vals)

        # ON CONFLICT: upsert on the unique constraint (series_id, region_code, date, vintage)
        update_parts = []
        for c, v in zip(cols, vals):
            if c not in ("series_id", "region_code", "date", "vintage"):
                update_parts.append(f"{c} = EXCLUDED.{c}")
        update_str = ", ".join(update_parts)

        statements.append(
            f"INSERT INTO observations ({col_str}) VALUES ({val_str}) "
            f"ON CONFLICT (series_id, region_code, date, vintage) "
            f"DO UPDATE SET {update_str};"
        )

    full_sql = "BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;\n"

    if dry_run:
        print("--- DRY RUN: SQL that would be executed ---")
        print(full_sql[:3000])
        if len(full_sql) > 3000:
            print(f"... ({len(full_sql)} chars total)")
        return

    # Execute
    print("Inserting into database...")
    psql(full_sql)

    # Verify
    src_count = psql("SELECT COUNT(*) FROM sources;")
    obs_count = psql("SELECT COUNT(*) FROM observations;")
    print(f"\nDone! Database now has:")
    print(f"  sources:      {src_count}")
    print(f"  observations: {obs_count}")

    # Show sample
    sample = psql(
        "SELECT series_id, region_code, date, value, unit "
        "FROM observations ORDER BY series_id, date LIMIT 5;"
    )
    print(f"\nSample observations:")
    for line in sample.split("\n"):
        if line.strip():
            print(f"  {line}")


if __name__ == "__main__":
    main()
