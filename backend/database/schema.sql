-- Requires pgcrypto for gen_random_uuid() - enabled by default on Supabase.
create extension if not exists pgcrypto;

create table if not exists tracked_products (
  id uuid primary key default gen_random_uuid(),
  product_id text not null unique,
  name text not null,
  url text not null,
  sku text,
  brand text,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists price_history (
  id bigserial primary key,
  tracked_product_id uuid not null references tracked_products(id),
  price numeric(12,2) not null,
  stock integer not null,
  scraped_at timestamptz not null default now()
);

create table if not exists scrape_logs (
  id bigserial primary key,
  tracked_product_id uuid not null references tracked_products(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null, -- 'success' | 'failed'
  attempts integer,
  price numeric(12,2),
  stock integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tracked_products_product_id on tracked_products(product_id);
create index if not exists idx_tracked_products_is_active on tracked_products(is_active);

create index if not exists idx_price_history_tracked_product_id on price_history(tracked_product_id);
create index if not exists idx_price_history_scraped_at on price_history(scraped_at);

create index if not exists idx_scrape_logs_tracked_product_id on scrape_logs(tracked_product_id);
create index if not exists idx_scrape_logs_started_at on scrape_logs(started_at desc);