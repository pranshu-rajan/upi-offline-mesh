-- ==============================================================================
-- UPI Offline Mesh — Supabase PostgreSQL Schema & Realtime Setup
-- ==============================================================================
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- to create tables, indexes, constraints, RLS policies, and realtime replication.

-- 1. Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
    vpa VARCHAR(64) PRIMARY KEY,
    holder_name VARCHAR(128) NOT NULL,
    balance NUMERIC(19, 2) NOT NULL CHECK (balance >= 0),
    version BIGINT NOT NULL DEFAULT 0
);

-- 2. Create transactions ledger table
CREATE TABLE IF NOT EXISTS public.transactions (
    id BIGSERIAL PRIMARY KEY,
    packet_hash VARCHAR(64) NOT NULL UNIQUE,
    sender_vpa VARCHAR(64) NOT NULL REFERENCES public.accounts(vpa) ON DELETE RESTRICT,
    receiver_vpa VARCHAR(64) NOT NULL REFERENCES public.accounts(vpa) ON DELETE RESTRICT,
    amount NUMERIC(19, 2) NOT NULL CHECK (amount > 0),
    signed_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bridge_node_id VARCHAR(64) NOT NULL,
    hop_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'SETTLED'
);

-- 3. Create mesh audit logs table (Optional edge packet observation tracker)
CREATE TABLE IF NOT EXISTS public.mesh_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    packet_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    device_id VARCHAR(64) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create indexes for high-throughput queries
CREATE INDEX IF NOT EXISTS idx_transactions_packet_hash ON public.transactions(packet_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_vpa ON public.transactions(sender_vpa);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_vpa ON public.transactions(receiver_vpa);
CREATE INDEX IF NOT EXISTS idx_transactions_settled_at ON public.transactions(settled_at DESC);

-- 5. Seed initial demo accounts if not already present
INSERT INTO public.accounts (vpa, holder_name, balance, version)
VALUES
    ('alice@demo', 'Alice', 5000.00, 0),
    ('bob@demo', 'Bob', 1000.00, 0),
    ('carol@demo', 'Carol', 2500.00, 0),
    ('dave@demo', 'Dave', 500.00, 0)
ON CONFLICT (vpa) DO NOTHING;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesh_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Allow read-only access for anonymous and authenticated clients
-- (Write permissions are executed by the Spring Boot backend via direct connection or service role)
DROP POLICY IF EXISTS "Allow public read accounts" ON public.accounts;
CREATE POLICY "Allow public read accounts" ON public.accounts
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read transactions" ON public.transactions;
CREATE POLICY "Allow public read transactions" ON public.transactions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read mesh_audit_logs" ON public.mesh_audit_logs;
CREATE POLICY "Allow public read mesh_audit_logs" ON public.mesh_audit_logs
    FOR SELECT USING (true);

-- 8. Enable Supabase Realtime for instant UI push updates
-- When the settlement engine settles a transaction in Postgres, the Next.js UI
-- receives a WebSocket event and updates immediately without polling lag!
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
