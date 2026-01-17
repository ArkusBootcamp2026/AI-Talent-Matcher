-- Migration: 008_rls_public
-- Purpose: Enable RLS and create policies for public tables.
-- Run after: 007_indexes
-- Run in: Supabase SQL Editor
-- Note: profiles INSERT is done via service role at signup; no INSERT policy for authenticated.

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: user can read own profile"
  ON public.profiles FOR SELECT TO public
  USING (id = auth.uid());

CREATE POLICY "Profiles: user can update own profile"
  ON public.profiles FOR UPDATE TO public
  USING (id = auth.uid());

-- candidate_profiles
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidate profiles: read own"
  ON public.candidate_profiles FOR SELECT TO public
  USING (profile_id = auth.uid());

CREATE POLICY "Candidate profiles: update own"
  ON public.candidate_profiles FOR UPDATE TO public
  USING (profile_id = auth.uid());

-- recruiter_profiles
ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiter profiles: read own"
  ON public.recruiter_profiles FOR SELECT TO public
  USING (profile_id = auth.uid());

CREATE POLICY "Recruiter profiles: update own"
  ON public.recruiter_profiles FOR UPDATE TO public
  USING (profile_id = auth.uid());

-- job_position
ALTER TABLE public.job_position ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs: public read open jobs"
  ON public.job_position FOR SELECT TO public
  USING (status = 'open');

CREATE POLICY "Recruiter can view own jobs"
  ON public.job_position FOR SELECT TO public
  USING (recruiter_profile_id = auth.uid());

CREATE POLICY "Jobs: recruiter can create"
  ON public.job_position FOR INSERT TO public
  WITH CHECK (recruiter_profile_id = auth.uid());

CREATE POLICY "Jobs: recruiter can update own"
  ON public.job_position FOR UPDATE TO public
  USING (recruiter_profile_id = auth.uid());

CREATE POLICY "Jobs: recruiter can delete own"
  ON public.job_position FOR DELETE TO public
  USING (recruiter_profile_id = auth.uid());

-- applications
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only candidates can apply"
  ON public.applications FOR INSERT TO public
  WITH CHECK (
    candidate_profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'candidate')
  );

CREATE POLICY "Applications: candidate can read own"
  ON public.applications FOR SELECT TO public
  USING (candidate_profile_id = auth.uid());

CREATE POLICY "Applications: recruiter can read job applications"
  ON public.applications FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.job_position jp
      WHERE jp.id = applications.job_position_id AND jp.recruiter_profile_id = auth.uid()
    )
  );

CREATE POLICY "candidate_can_withdraw_application"
  ON public.applications FOR UPDATE TO public
  USING (candidate_profile_id = auth.uid())
  WITH CHECK (candidate_profile_id = auth.uid() AND status = 'withdrawn');

CREATE POLICY "recruiter_can_update_application_status"
  ON public.applications FOR UPDATE TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.job_position jp
      WHERE jp.id = applications.job_position_id AND jp.recruiter_profile_id = auth.uid()
    )
  );
