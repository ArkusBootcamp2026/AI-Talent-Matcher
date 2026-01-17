-- Migration: 004_table_recruiter_profiles
-- Purpose: Create recruiter_profiles table for recruiter-specific data.
-- Run after: 002_table_profiles
-- Run in: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.recruiter_profiles (
  profile_id uuid NOT NULL,
  company_name text NOT NULL,
  company_size text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT recruiter_profiles_pkey PRIMARY KEY (profile_id),
  CONSTRAINT recruiter_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE NO ACTION
);

COMMENT ON TABLE public.recruiter_profiles IS 'Recruiter-specific profile. One per recruiter.';
