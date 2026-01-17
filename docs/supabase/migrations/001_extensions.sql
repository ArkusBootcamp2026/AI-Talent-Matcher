-- Migration: 001_extensions
-- Purpose: Enable PostgreSQL extensions used by the application or Supabase.
-- Run in: Supabase SQL Editor
-- Note: Some extensions (pg_graphql, supabase_vault, pg_stat_statements) may
-- already be enabled or require Supabase dashboard. IF NOT EXISTS avoids errors.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optional: typically enabled in Supabase. Uncomment if your project needs them.
-- CREATE EXTENSION IF NOT EXISTS "pg_graphql";
-- CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
-- CREATE EXTENSION IF NOT EXISTS "supabase_vault";
