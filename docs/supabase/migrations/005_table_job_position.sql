-- Migration: 005_table_job_position
-- Purpose: Create job_position table for job postings.
-- Run after: 004_table_recruiter_profiles
-- Run in: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.job_position (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  job_title text,
  job_description text,
  job_requirements text,
  job_skills text,
  location text,
  employment_type text,
  optional_salary integer,
  optional_salary_max integer,
  closing_date date,
  sprint_duration text,
  recruiter_profile_id uuid NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'draft')),
  CONSTRAINT job_position_pkey PRIMARY KEY (id),
  CONSTRAINT fk_job_position_recruiter FOREIGN KEY (recruiter_profile_id) REFERENCES public.recruiter_profiles(profile_id) ON DELETE CASCADE,
  CONSTRAINT job_position_salary_range_check CHECK (
    optional_salary IS NULL OR optional_salary_max IS NULL OR optional_salary <= optional_salary_max
  )
);

COMMENT ON TABLE public.job_position IS 'Job postings. Recruiters create and manage their own.';
