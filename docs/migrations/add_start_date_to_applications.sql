-- Migration: Add start_date column to applications table
-- Purpose: Store the start date for hired candidates
-- This allows tracking when hired candidates are scheduled to start

-- Add start_date column (stores date in YYYY-MM-DD format)
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Add comment to document the column
COMMENT ON COLUMN public.applications.start_date IS 'Start date for hired candidates (YYYY-MM-DD format). Only applicable when status is "hired".';
