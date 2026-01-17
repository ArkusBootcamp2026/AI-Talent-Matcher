-- Migration: 007_indexes
-- Purpose: Add non-PK indexes for performance (match score filtering/sorting).
-- Run after: 006_table_applications
-- Run in: Supabase SQL Editor

CREATE INDEX IF NOT EXISTS idx_applications_match_score
  ON public.applications (match_score DESC NULLS LAST);
