-- Supabase PostgreSQL Schema for Price Tracker

-- 1. Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    external_id TEXT NOT NULL UNIQUE,
    image_url TEXT,
    scrape_interval_minutes INT DEFAULT 120,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Price history table
CREATE TABLE price_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    in_stock BOOLEAN NOT NULL,
    scraped_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Scrape logs table
CREATE TABLE scrape_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
    attempts INT NOT NULL,
    message TEXT,
    duration_ms INT,
    scraped_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying by product and sorting by most recent
CREATE INDEX idx_price_history_product_time ON price_history(product_id, scraped_at DESC);
CREATE INDEX idx_scrape_logs_product_time ON scrape_logs(product_id, scraped_at DESC);

-- 4. Catalog table (Mirrored search index)
CREATE TABLE catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    image_url TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT now()
);

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a GIN index for blazing fast ILIKE searches
CREATE INDEX idx_catalog_name_trgm ON catalog USING GIN (name gin_trgm_ops);
