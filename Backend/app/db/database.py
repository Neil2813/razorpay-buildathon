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
        company_name TEXT,
        support_email TEXT,
        support_phone TEXT,
        razorpay_key_id TEXT,
        razorpay_key_secret TEXT,
        unattended_spend_ceiling REAL NOT NULL DEFAULT 5000.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Column migrations for existing databases
    for col in [("razorpay_key_id", "TEXT"), ("razorpay_key_secret", "TEXT")]:
        try:
            cursor.execute(f"ALTER TABLE tenants ADD COLUMN {col[0]} {col[1]};")
        except sqlite3.OperationalError:
            pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS addresses (
        address_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        label TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        line1 TEXT NOT NULL,
        line2 TEXT,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        pincode TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS warehouses (
        warehouse_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        line1 TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        pincode TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
    );
    """)

    # Create table with correct constraint if not exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS delivery_zones (
        zone_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        coverage_type TEXT NOT NULL CHECK (coverage_type IN ('all_india', 'state', 'city', 'pincode')),
        coverage_value TEXT NOT NULL,
        shipping_fee REAL NOT NULL DEFAULT 0,
        delivery_days INTEGER NOT NULL DEFAULT 3,
        active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
    );
    """)

    # Try inserting 'city' into delivery_zones to see if constraint needs migration
    cursor.execute("SELECT 1 FROM tenants WHERE tenant_id = 'demo_tenant';")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO tenants (tenant_id, name) VALUES ('demo_tenant', 'Demo Merchant Store');")
    
    try:
        cursor.execute("SAVEPOINT test_city;")
        cursor.execute("INSERT INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days, active) VALUES ('test_mig_id', 'demo_tenant', 'city', 'test_city', 0, 1, 0);")
        cursor.execute("ROLLBACK TO test_city;")
        cursor.execute("RELEASE test_city;")
    except sqlite3.IntegrityError:
        cursor.execute("ROLLBACK TO test_city;")
        cursor.execute("RELEASE test_city;")
        # Constraint migration needed
        cursor.execute("ALTER TABLE delivery_zones RENAME TO delivery_zones_old;")
        cursor.execute("""
        CREATE TABLE delivery_zones (
            zone_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            coverage_type TEXT NOT NULL CHECK (coverage_type IN ('all_india', 'state', 'city', 'pincode')),
            coverage_value TEXT NOT NULL,
            shipping_fee REAL NOT NULL DEFAULT 0,
            delivery_days INTEGER NOT NULL DEFAULT 3,
            active INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
        );
        """)
        cursor.execute("""
        INSERT INTO delivery_zones (zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days, active)
        SELECT zone_id, tenant_id, coverage_type, coverage_value, shipping_fee, delivery_days, active FROM delivery_zones_old;
        """)
        cursor.execute("DROP TABLE delivery_zones_old;")

    # Create fulfilment_orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fulfilment_orders (
        order_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        warehouse_id TEXT NOT NULL,
        shipping_fee REAL NOT NULL,
        tax_amount REAL NOT NULL,
        total_amount REAL NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_estimate_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES transactions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES catalog(product_id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE
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

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS warehouse_inventory (
        warehouse_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (warehouse_id, product_id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES catalog(product_id) ON DELETE CASCADE
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
        rating REAL,
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

    catalog_columns = {row[1] for row in cursor.execute("PRAGMA table_info(catalog);")}
    if "rating" not in catalog_columns:
        cursor.execute("ALTER TABLE catalog ADD COLUMN rating REAL;")
    tenant_columns = {row[1] for row in cursor.execute("PRAGMA table_info(tenants);")}
    for column in ("company_name", "support_email", "support_phone"):
        if column not in tenant_columns:
            cursor.execute(f"ALTER TABLE tenants ADD COLUMN {column} TEXT;")

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
        SELECT product_id, tenant_id, name, description, price, category, color, sizes, in_stock, return_policy, delivery_time_days, rating
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


def get_addresses(user_id: str) -> list[dict[str, Any]]:
    conn = get_db_connection()
    try:
        return [dict(row) for row in conn.execute("SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC;", (user_id,))]
    finally:
        conn.close()


def save_address(user_id: str, address: dict[str, Any]) -> dict[str, Any]:
    from uuid import uuid4
    address_id = address.get("address_id") or str(uuid4())
    conn = get_db_connection()
    try:
        with conn:
            if address.get("is_default"):
                conn.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?;", (user_id,))
            conn.execute("""
                INSERT INTO addresses (address_id, user_id, label, recipient_name, phone, line1, line2, city, state, pincode, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(address_id) DO UPDATE SET label=excluded.label, recipient_name=excluded.recipient_name, phone=excluded.phone,
                  line1=excluded.line1, line2=excluded.line2, city=excluded.city, state=excluded.state, pincode=excluded.pincode, is_default=excluded.is_default
            """, (address_id, user_id, address["label"], address["recipient_name"], address["phone"], address["line1"], address.get("line2"), address["city"], address["state"], address["pincode"], int(address.get("is_default", False))))
            row = conn.execute("SELECT * FROM addresses WHERE address_id = ? AND user_id = ?;", (address_id, user_id)).fetchone()
            return dict(row)
    finally:
        conn.close()


def get_checkout_catalog(tenant_id: str, address: dict[str, Any]) -> list[dict[str, Any]]:
    """Return only merchant SKUs that can be fulfilled to the buyer's address."""
    products = query_catalog(tenant_id)
    conn = get_db_connection()
    try:
        zones = [dict(row) for row in conn.execute("SELECT * FROM delivery_zones WHERE tenant_id = ? AND active = 1;", (tenant_id,))]
        warehouses = [dict(row) for row in conn.execute("SELECT w.*, COALESCE(SUM(i.quantity), 0) AS inventory_total FROM warehouses w LEFT JOIN warehouse_inventory i ON i.warehouse_id=w.warehouse_id WHERE w.tenant_id=? AND w.active=1 GROUP BY w.warehouse_id;", (tenant_id,))]
        
        # Filter matching zones
        matching_zones = []
        for z in zones:
            cov_type = z["coverage_type"]
            cov_val = z["coverage_value"].lower()
            if cov_type == "all_india":
                matching_zones.append(z)
            elif cov_type == "state" and cov_val == address["state"].lower():
                matching_zones.append(z)
            elif cov_type == "city" and cov_val == address["city"].lower():
                matching_zones.append(z)
            elif cov_type == "pincode" and cov_val == address["pincode"]:
                matching_zones.append(z)

        if not matching_zones:
            return []

        # Sort matching zones by specificity (narrowest/pincode first)
        specificity_priority = {"pincode": 0, "city": 1, "state": 2, "all_india": 3}
        matching_zones = sorted(
            matching_zones,
            key=lambda z: (specificity_priority.get(z["coverage_type"], 4), z["shipping_fee"], z["delivery_days"])
        )
        zone = matching_zones[0]

        for product in products:
            stock_rows = [dict(row) for row in conn.execute("SELECT w.*, i.quantity FROM warehouse_inventory i JOIN warehouses w ON w.warehouse_id=i.warehouse_id WHERE i.product_id=? AND w.tenant_id=? AND w.active=1 AND i.quantity > 0;", (product["product_id"], tenant_id))]
            
            # Sort stock_rows by distance score to choose the nearest eligible warehouse
            def get_distance_score(w: dict) -> int:
                if w["pincode"] == address["pincode"]:
                    return 0
                if w["city"].lower() == address["city"].lower():
                    return 1
                if w["state"].lower() == address["state"].lower():
                    return 2
                return 3

            stock_rows = sorted(stock_rows, key=get_distance_score)
            warehouse = stock_rows[0] if stock_rows else None
            
            # Backward-compatible product-level stock is fulfillable from the first warehouse if warehouses exist.
            if warehouse is None and product.get("in_stock") and warehouses:
                warehouse = warehouses[0]
                
            if warehouse:
                price = float(product["price"])
                tax_rate = 0.18
                tax_amount = round(price * tax_rate, 2)
                shipping_fee = float(zone["shipping_fee"])
                total_amount = round(price + shipping_fee + tax_amount, 2)

                from datetime import datetime, timedelta
                delivery_days = int(zone["delivery_days"])
                est_date = datetime.now() + timedelta(days=delivery_days)
                est_date_str = est_date.strftime("%A, %b %d")

                product["fulfilment"] = {
                    "warehouse_id": warehouse["warehouse_id"],
                    "warehouse_name": warehouse["name"],
                    "shipping_fee": shipping_fee,
                    "tax_amount": tax_amount,
                    "delivery_days": delivery_days,
                    "delivery_estimate": est_date_str,
                    "address_id": address["address_id"]
                }
                product["total_amount"] = total_amount

        return [product for product in products if product.get("fulfilment")]
    finally:
        conn.close()


def create_fulfilment_order(
    session_id: str,
    tenant_id: str,
    product_id: str,
    warehouse_id: str,
    shipping_fee: float,
    tax_amount: float,
    total_amount: float,
    delivery_address: dict[str, Any],
    delivery_days: int
) -> dict[str, Any]:
    """Create a fulfilment order in database and decrement inventory stock by 1.

    Raises RuntimeError if the product is out of stock at the requested warehouse
    so callers can rollback the transaction and surface an error to the buyer.
    """
    from uuid import uuid4
    from datetime import datetime, timedelta
    order_id = f"ord_{uuid4().hex[:12]}"
    conn = get_db_connection()
    try:
        est_date = datetime.now() + timedelta(days=delivery_days)
        est_date_str = est_date.strftime("%Y-%m-%d")
        
        with conn:
            # 1. Insert order
            conn.execute("""
                INSERT INTO fulfilment_orders (
                    order_id, session_id, tenant_id, product_id, warehouse_id,
                    shipping_fee, tax_amount, total_amount, delivery_address,
                    delivery_estimate_date, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
            """, (
                order_id, session_id, tenant_id, product_id, warehouse_id,
                shipping_fee, tax_amount, total_amount, json.dumps(delivery_address),
                est_date_str
            ))
            
            # 2. Atomic inventory decrement: only succeed if stock > 0.
            # MAX(0, quantity-1) is NOT safe under concurrency — it silently
            # allows all concurrent buyers through even when stock = 0.
            cursor = conn.execute("""
                UPDATE warehouse_inventory
                SET quantity = quantity - 1
                WHERE warehouse_id = ? AND product_id = ? AND quantity > 0
            """, (warehouse_id, product_id))
            
            if cursor.rowcount == 0:
                # No row was updated → stock was already exhausted.
                # The 'with conn' context manager will automatically rollback
                # the INSERT above, keeping the database consistent.
                raise RuntimeError(
                    f"Inventory stock exhausted for product_id={product_id} "
                    f"at warehouse_id={warehouse_id}. Order cannot be fulfilled."
                )
            
            # Retrieve created order
            row = conn.execute("SELECT * FROM fulfilment_orders WHERE order_id = ?;", (order_id,)).fetchone()
            return dict(row)
    finally:
        conn.close()



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


def get_transaction_by_order_id(razorpay_order_id: str) -> dict[str, Any] | None:
    """Look up a transaction by its Razorpay order ID.

    Used by the webhook handler to reconcile payment.captured events when the
    buyer's browser drops the connection before /verify-payment is called.
    Returns the full deserialized state dict, or None if not found.
    """
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT state_json, tenant_id FROM transactions WHERE state_json LIKE ?;",
            (f'%"{razorpay_order_id}"%',),
        ).fetchone()
        if not row:
            return None
        state = json.loads(row["state_json"])
        # Only return if the stored order_id matches exactly (avoid LIKE false positives)
        if state.get("razorpay_order_id") == razorpay_order_id:
            return state
        return None
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
