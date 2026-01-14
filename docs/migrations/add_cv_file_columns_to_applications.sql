-- Migration: Add CV file tracking columns to applications table
-- Purpose: Store the exact CV file path and timestamp when a candidate applies to a job
-- This ensures we can retrieve the exact CV version that was active at application time

-- Add cv_file_timestamp column (stores timestamp in YYYYMMDD_HHMMSS format)
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS cv_file_timestamp TEXT;

-- Add cv_file_path column (stores full file path for reference)
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS cv_file_path TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN public.applications.cv_file_timestamp IS 'CV file timestamp (YYYYMMDD_HHMMSS format) stored when candidate applied. Used to retrieve exact CV version.';
COMMENT ON COLUMN public.applications.cv_file_path IS 'Full CV file path in Supabase Storage stored when candidate applied. Used for reference and debugging.';

-- Optional: Create an index on cv_file_timestamp for faster lookups (if needed)
-- CREATE INDEX IF NOT EXISTS idx_applications_cv_file_timestamp ON public.applications(cv_file_timestamp);
