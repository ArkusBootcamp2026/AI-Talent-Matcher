-- Migration: 003_table_candidate_profiles
-- Purpose: Create candidate_profiles table for candidate-specific data.
-- Run after: 002_table_profiles
-- Run in: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  profile_id uuid NOT NULL,
  location text,
  created_at timestamptz DEFAULT now(),
  last_upload_file date,
  CONSTRAINT candidate_profiles_pkey PRIMARY KEY (profile_id),
  CONSTRAINT candidate_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE NO ACTION
);

COMMENT ON TABLE public.candidate_profiles IS 'Candidate-specific profile. One per candidate.';
