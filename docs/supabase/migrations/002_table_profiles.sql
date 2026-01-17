-- Migration: 002_table_profiles
-- Purpose: Create profiles table. Links to auth.users (Supabase Auth).
-- Run after: 001_extensions
-- Run in: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('recruiter', 'candidate')),
  created_at timestamptz DEFAULT now(),
  phone numeric,
  avatar_url text,
  role_title text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.profiles IS 'Shared identity for all users. id = auth.uid().';
