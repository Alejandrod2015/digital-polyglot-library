-- Add 'app_store' to the BillingSource enum (Apple In-App Purchase via StoreKit 2).
-- Additive, non-destructive. Postgres requires ALTER TYPE ... ADD VALUE.
ALTER TYPE "BillingSource" ADD VALUE IF NOT EXISTS 'app_store';
