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


try:
    from supabase import Client, create_client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False

_supabase_client: Client | None = None


def get_supabase_client() -> Client | None:
    """Return an active Supabase client instance if credentials are present."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if HAS_SUPABASE and settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            return _supabase_client
        except Exception as e:
            print(f"[db] Failed to initialize Supabase client: {e}")
            return None
    return None


def get_db_connection() -> sqlite3.Connection:
    """Return a connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = FULL;")
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
        idempotency_key TEXT,
        state_json TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (chosen_product_id) REFERENCES catalog (product_id) ON DELETE SET NULL
    );
    """)

    # Lightweight forward migrations for existing demo databases.
    transaction_columns = {row[1] for row in cursor.execute("PRAGMA table_info(transactions);")}
    if "idempotency_key" not in transaction_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN idempotency_key TEXT;")
    if "state_json" not in transaction_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN state_json TEXT NOT NULL DEFAULT '{}';")

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


# ---------------------------------------------------------------------------
# Transaction checkpointing (write-ahead state and audit persistence)
# ---------------------------------------------------------------------------
def checkpoint_transaction(state: dict[str, Any], *, from_event_index: int = 0) -> int:
    """Atomically save current state and newly appended audit events.

    Callers must use this before an irreversible external side effect, such as
    a payment gateway request. The stored state includes the idempotency key so
    a resumed transaction can use the same provider request identity.
    """
    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR IGNORE INTO tenants (tenant_id, name) VALUES (?, ?);",
                (state["tenant_id"], f"Tenant {state['tenant_id']}"),
            )
            chosen_product = state.get("chosen_product") or {}
            chosen_product_id = chosen_product.get("product_id")
            # Catalog may be supplied by an external tenant-scoped repository;
            # retain the full choice in state_json without violating this local
            # database's optional catalog foreign key.
            if chosen_product_id and not cursor.execute(
                "SELECT 1 FROM catalog WHERE product_id = ? AND tenant_id = ?;",
                (chosen_product_id, state["tenant_id"]),
            ).fetchone():
                chosen_product_id = None
            cursor.execute(
                """
                INSERT INTO transactions (
                    session_id, tenant_id, user_message, payment_status,
                    chosen_product_id, risk_score, idempotency_key, state_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    payment_status = excluded.payment_status,
                    chosen_product_id = excluded.chosen_product_id,
                    risk_score = excluded.risk_score,
                    idempotency_key = COALESCE(transactions.idempotency_key, excluded.idempotency_key),
                    state_json = excluded.state_json
                """,
                (
                    state["session_id"], state["tenant_id"], state["user_message"],
                    state["payment_status"], chosen_product_id, state.get("risk_score"),
                    state.get("idempotency_key"), json.dumps(state, default=str),
                ),
            )
            for event in state.get("audit_log", [])[from_event_index:]:
                cursor.execute(
                    """
                    INSERT OR IGNORE INTO audit_events (
                        event_id, session_id, tenant_id, timestamp, agent,
                        inputs_summary, output_summary, decision_reason
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event["event_id"], state["session_id"], state["tenant_id"], event["timestamp"], event["agent"],
                        json.dumps(event["inputs_summary"], default=str), json.dumps(event["output_summary"], default=str),
                        event["decision_reason"],
                    ),
                )
        return len(state.get("audit_log", []))
    finally:
        conn.close()


def load_transaction_checkpoint(session_id: str, tenant_id: str) -> dict[str, Any] | None:
    """Load state only when the caller proves the transaction's tenant scope."""
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT state_json FROM transactions WHERE session_id = ? AND tenant_id = ?;",
            (session_id, tenant_id),
        ).fetchone()
        return json.loads(row["state_json"]) if row else None
    finally:
        conn.close()


def get_transaction_history(tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Retrieve history of transactions for a given tenant."""
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT session_id, tenant_id, user_message, payment_status, chosen_product_id, risk_score, state_json, created_at
            FROM transactions
            WHERE tenant_id = ?
            ORDER BY created_at DESC
            LIMIT ?;
            """,
            (tenant_id, limit),
        ).fetchall()

        history = []
        for row in rows:
            item = dict(row)
            try:
                state = json.loads(item.pop("state_json", "{}"))
                item["chosen_product"] = state.get("chosen_product")
                item["escalation_message"] = state.get("escalation_message")
                item["audit_count"] = len(state.get("audit_log", []))
            except Exception:
                item["chosen_product"] = None
                item["escalation_message"] = None
                item["audit_count"] = 0
            history.append(item)
        return history
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    print("[db] Database initialization completed successfully.")
