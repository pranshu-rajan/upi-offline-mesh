# 🗄️ Supabase Setup & Full-Stack Integration Guide

This guide details how to configure **Supabase** (PostgreSQL + Realtime WebSockets) with the **Spring Boot Core Settlement Engine** (deployed on Render) and the **Next.js Web Dashboard** (deployed on Vercel).

---

## 1. Create Supabase Project

1. Go to [database.new](https://database.new) and sign in to Supabase.
2. Click **New Project**, select an organization, name the project `upi-offline-mesh`, and choose a strong database password.
3. Choose a region closest to your Render server (e.g. `ap-south-1` Mumbai or `us-east-1`).

---

## 2. Initialize Database Schema

1. Open your project dashboard and navigate to **SQL Editor** (left navigation bar).
2. Click **New Query**, paste the entire contents of [`supabase/schema.sql`](./schema.sql), and click **Run**.
3. This creates:
   - `public.accounts` table with optimistic locking (`version`) and demo balances for Alice, Bob, Carol, and Dave.
   - `public.transactions` ledger table with unique index on `packet_hash`.
   - `public.mesh_audit_logs` table for tracking mesh hop events.
   - Row Level Security (RLS) policies allowing public read access for the Next.js frontend.
   - Realtime publication on `accounts` and `transactions` tables.

---

## 3. Configure Spring Boot Backend (Render)

1. In Supabase, go to **Project Settings** &rarr; **Database** &rarr; **Connection String** &rarr; **URI**.
2. Note the connection details:
   - **Host**: `db.<project-ref>.supabase.co` (or pooler `aws-0-<region>.pooler.supabase.com`)
   - **Port**: `5432` (Direct) or `6543` (Transaction Pooler)
   - **Database**: `postgres`
   - **Username**: `postgres`
   - **Password**: `<your-database-password>`
3. Go to your **Render Dashboard** &rarr; select your backend web service `upi-offline-mesh-rrm4` &rarr; **Environment**.
4. Add the following environment variables:
   ```bash
   # Option A: Full JDBC URL (Recommended)
   SPRING_DATASOURCE_URL=jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require
   SPRING_DATASOURCE_USERNAME=postgres
   SPRING_DATASOURCE_PASSWORD=<your-db-password>
   SPRING_JPA_HIBERNATE_DDL_AUTO=update
   ```
5. Click **Save Changes**. Render will redeploy the service. The Spring Boot backend will now persist all settled transactions and balances directly to Supabase!

---

## 4. Configure Next.js Frontend (Vercel)

1. In Supabase, go to **Project Settings** &rarr; **API Keys**.
2. Copy:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **anon / public key**: `eyJh...`
3. Go to your **Vercel Dashboard** &rarr; select project `upi-offline-rho` &rarr; **Settings** &rarr; **Environment Variables**.
4. Add:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
   ```
5. Click **Save** and trigger a **Redeploy**.

---

## 5. Local Development (`.env.local`)

To test with Supabase locally:
1. In `frontend/.env.local`:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8080/api
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
2. In root `.env`:
   ```bash
   SPRING_DATASOURCE_URL=jdbc:postgresql://db.<project-ref>.supabase.co:5432/postgres?sslmode=require
   SPRING_DATASOURCE_USERNAME=postgres
   SPRING_DATASOURCE_PASSWORD=your_password
   ```
3. If no database variables are provided, the backend seamlessly falls back to the H2 in-memory database (`jdbc:h2:mem:upimesh`).
