-- Migration 02: Add Phase 2 columns to Supabase PostgreSQL database

-- 1. Update products table
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}'::jsonb;

-- 2. Update price_history table
ALTER TABLE price_history 
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS stock_units INT,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS rating_count INT,
  ADD COLUMN IF NOT EXISTS seller TEXT,
  ADD COLUMN IF NOT EXISTS delivery_days INT;

-- 3. Update scrape_logs table
ALTER TABLE scrape_logs 
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms INT;

-- 4. Update catalog table for enriched search capabilities
ALTER TABLE catalog
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;
