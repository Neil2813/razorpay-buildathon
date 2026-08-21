"""
SQLite database engine for GlassBox Backend.
Sets up the schema and seeds initial demo-ready data.
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Generator

from app.core.config import settings

def get_db_connection() -> sqlite3.Connection:
    """Return a connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Create all tables and seed default mock catalog and tenant data."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Tenants Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unattended_spend_ceiling REAL NOT NULL DEFAULT 5000.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Catalog Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS catalog (
        product_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        color TEXT NOT NULL,
        sizes TEXT NOT NULL, -- JSON array of strings e.g. ["S", "M", "9"]
        in_stock INTEGER NOT NULL DEFAULT 1, -- boolean 0/1
        return_policy TEXT, -- policy text (missing policy leads to rejection stats)
        delivery_time_days INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id) ON DELETE CASCADE
    );
    """)

    # 3. Transactions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        session_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_message TEXT NOT NULL,
        payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'success', 'failed', 'escalated')),
        chosen_product_id TEXT,
        risk_score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (chosen_product_id) REFERENCES catalog (product_id) ON DELETE SET NULL
    );
    """)

    # 4. Audit Events Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        agent TEXT NOT NULL,
        inputs_summary TEXT NOT NULL, -- JSON string
        output_summary TEXT NOT NULL, -- JSON string
        decision_reason TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES transactions (session_id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()


def query_catalog(tenant_id: str) -> list[dict[str, Any]]:
    """Return all catalog products for a tenant parsed into standard dictionaries."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT product_id, tenant_id, name, description, price, category, color, sizes, in_stock, return_policy, delivery_time_days
    FROM catalog
    WHERE tenant_id = ?;
    """, (tenant_id,))
    rows = cursor.fetchall()
    conn.close()

    products = []
    for row in rows:
        prod = dict(row)
        # Parse JSON size list
        try:
            prod["sizes"] = json.loads(prod["sizes"])
        except Exception:
            prod["sizes"] = []
        prod["in_stock"] = bool(prod["in_stock"])
        products.append(prod)
    return products


def get_tenant_ceiling(tenant_id: str) -> float:
    """Get the spend ceiling for a tenant, fallback to 5000.0 if not found."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT unattended_spend_ceiling FROM tenants WHERE tenant_id = ?;", (tenant_id,))
    row = cursor.fetchone()
    conn.close()
    return float(row["unattended_spend_ceiling"]) if row else 5000.0


if __name__ == "__main__":
    init_db()
    print("[db] Database initialization completed successfully.")
