-- Migration: 010_storage_policies
-- Purpose: RLS policies on storage.objects for avatars, cvs, and cvs/match_results.
-- Run after: 009_storage_buckets
-- Run in: Supabase SQL Editor
-- Paths: avatars: (auth.uid())/*; cvs: (auth.uid())/raw|parsed|match_results/*

-- Avatars
CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- CVs (user_id/raw|parsed|...)
CREATE POLICY "Users can upload their own CVs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own CVs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own CVs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- CVs match_results (user_id/match_results/*)
CREATE POLICY "Users can read own match results"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] = 'match_results'
  );

CREATE POLICY "Users can write own match results"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cvs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (storage.foldername(name))[2] = 'match_results'
  );

CREATE POLICY "Service role can manage all match results"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'cvs' AND (storage.foldername(name))[2] = 'match_results');
