"""
SQLite database engine for GlassBox Backend.
Sets up the schema and helper functions for database interactions.
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any

from app.core.config import settings


def get_db_connection() -> sqlite3.Connection:
    """Return a connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Create all tables if they do not exist."""
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

    # 2. Users Table (Multi-tenancy & RBAC)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('buyer', 'merchant_admin', 'platform_admin')),
        tenant_id TEXT NOT NULL DEFAULT 'demo_tenant',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id) ON DELETE CASCADE
    );
    """)

    # 3. Catalog Table
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

    # 4. Transactions Table
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

    # 5. Audit Events Table
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


# ---------------------------------------------------------------------------
# User / Auth Database Queries
# ---------------------------------------------------------------------------
def create_user(
    user_id: str,
    email: str,
    password_hash: str,
    salt: str,
    full_name: str,
    role: str = "buyer",
    tenant_id: str = "demo_tenant",
) -> dict[str, Any]:
    """Insert a new user record."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Ensure tenant exists or create default
    cursor.execute("SELECT 1 FROM tenants WHERE tenant_id = ?;", (tenant_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO tenants (tenant_id, name) VALUES (?, ?);", (tenant_id, f"Tenant {tenant_id}"))

    cursor.execute(
        """
        INSERT INTO users (user_id, email, password_hash, salt, full_name, role, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        (user_id, email.lower(), password_hash, salt, full_name, role, tenant_id),
    )
    conn.commit()
    conn.close()
    return get_user_by_id(user_id)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    """Retrieve user dictionary by email."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?);", (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    """Retrieve user dictionary by user_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = ?;", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_user_profile(user_id: str, full_name: str | None = None, email: str | None = None) -> dict[str, Any] | None:
    """Update profile attributes for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    fields = []
    values = []

    if full_name:
        fields.append("full_name = ?")
        values.append(full_name)
    if email:
        fields.append("email = ?")
        values.append(email.lower())

    if fields:
        values.append(user_id)
        cursor.execute(f"UPDATE users SET {', '.join(fields)} WHERE user_id = ?;", values)
        conn.commit()

    conn.close()
    return get_user_by_id(user_id)


# ---------------------------------------------------------------------------
# Tenant Database Queries
# ---------------------------------------------------------------------------
def get_tenant(tenant_id: str) -> dict[str, Any] | None:
    """Get tenant row dictionary."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tenants WHERE tenant_id = ?;", (tenant_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_tenant_settings(tenant_id: str, name: str | None = None, unattended_spend_ceiling: float | None = None) -> dict[str, Any] | None:
    """Update spend ceiling or tenant metadata."""
    conn = get_db_connection()
    cursor = conn.cursor()
    fields = []
    values = []

    if name:
        fields.append("name = ?")
        values.append(name)
    if unattended_spend_ceiling is not None:
        fields.append("unattended_spend_ceiling = ?")
        values.append(float(unattended_spend_ceiling))

    if fields:
        values.append(tenant_id)
        cursor.execute(f"UPDATE tenants SET {', '.join(fields)} WHERE tenant_id = ?;", values)
        conn.commit()

    conn.close()
    return get_tenant(tenant_id)


# ---------------------------------------------------------------------------
# Catalog Queries
# ---------------------------------------------------------------------------
def query_catalog(tenant_id: str) -> list[dict[str, Any]]:
    """Return all catalog products for a tenant parsed into standard dictionaries."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT product_id, tenant_id, name, description, price, category, color, sizes, in_stock, return_policy, delivery_time_days
        FROM catalog
        WHERE tenant_id = ?;
        """,
        (tenant_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    products = []
    for row in rows:
        prod = dict(row)
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
