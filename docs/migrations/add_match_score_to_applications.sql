-- Migration: Add match_score column to applications table
-- Purpose: Store the AI-calculated match score for each application
-- This allows recruiters to see how well a candidate matches the job requirements
-- 
-- IMPORTANT: Run this SQL in your Supabase SQL Editor
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Click "New query"
-- 3. Paste this entire file
-- 4. Click "Run"

-- Add match_score column (stores float value 0.0 to 1.0)
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS match_score NUMERIC(5, 3);

-- Add constraint to ensure match_score is between 0.0 and 1.0
-- Note: IF NOT EXISTS doesn't work for constraints, so we check first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'applications_match_score_check'
    ) THEN
        ALTER TABLE public.applications
        ADD CONSTRAINT applications_match_score_check 
        CHECK (match_score IS NULL OR (match_score >= 0.0 AND match_score <= 1.0));
    END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN public.applications.match_score IS 'AI-calculated match score (0.0 to 1.0) indicating how well the candidate matches the job requirements. NULL if not yet calculated.';

-- Create index for faster queries when filtering/sorting by match score
CREATE INDEX IF NOT EXISTS idx_applications_match_score ON public.applications(match_score DESC NULLS LAST);

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'applications' 
  AND column_name = 'match_score';
