-- Migration: 006_table_applications
-- Purpose: Create applications table. One row per candidate per job.
-- Run after: 003_table_candidate_profiles, 005_table_job_position
-- Run in: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.applications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  candidate_profile_id uuid NOT NULL,
  job_position_id integer NOT NULL,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN (
    'applied', 'reviewing', 'shortlisted', 'rejected', 'hired', 'withdrawn'
  )),
  cover_letter text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cv_file_timestamp text,
  cv_file_path text,
  start_date date,
  match_score numeric(5,3) CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 1)),
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT uq_candidate_job_application UNIQUE (candidate_profile_id, job_position_id),
  CONSTRAINT fk_applications_candidate FOREIGN KEY (candidate_profile_id) REFERENCES public.candidate_profiles(profile_id) ON DELETE CASCADE,
  CONSTRAINT fk_applications_job FOREIGN KEY (job_position_id) REFERENCES public.job_position(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.applications IS 'Candidate applications to jobs. cv_file_* and match_score filled by backend.';
COMMENT ON COLUMN public.applications.cv_file_timestamp IS 'CV file timestamp (YYYYMMDD_HHMMSS) when candidate applied.';
COMMENT ON COLUMN public.applications.cv_file_path IS 'CV file path in storage when candidate applied.';
COMMENT ON COLUMN public.applications.match_score IS 'AI match score 0–1. NULL until calculated.';
COMMENT ON COLUMN public.applications.start_date IS 'Start date when status is hired.';
