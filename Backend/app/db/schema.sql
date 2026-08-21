-- Supabase / PostgreSQL Schema for GlassBox Backend

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unattended_spend_ceiling DOUBLE PRECISION NOT NULL DEFAULT 5000.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Extensions for Supabase Auth / Local Users)
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    salt TEXT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'merchant_admin', 'platform_admin')),
    tenant_id TEXT NOT NULL DEFAULT 'demo_tenant' REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Catalog Table
CREATE TABLE IF NOT EXISTS catalog (
    product_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DOUBLE PRECISION NOT NULL,
    category TEXT NOT NULL,
    color TEXT NOT NULL,
    sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    return_policy TEXT,
    delivery_time_days INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    session_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'success', 'failed', 'escalated')),
    chosen_product_id TEXT REFERENCES catalog(product_id) ON DELETE SET NULL,
    risk_score DOUBLE PRECISION,
    idempotency_key TEXT,
    state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Events Table
CREATE TABLE IF NOT EXISTS audit_events (
    event_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES transactions(session_id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    agent TEXT NOT NULL,
    inputs_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    decision_reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default Tenant Insert
INSERT INTO tenants (tenant_id, name, unattended_spend_ceiling)
VALUES ('demo_tenant', 'Demo Merchant Store', 5000.0)
ON CONFLICT (tenant_id) DO NOTHING;
