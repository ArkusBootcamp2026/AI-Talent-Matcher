-- Migration: 009_storage_buckets
-- Purpose: Create storage buckets for avatars and CVs (and match_results under cvs).
-- Run after: 008_rls_public
-- Run in: Supabase SQL Editor
-- Note: If storage.buckets.id is UUID or INSERT fails, create buckets from
-- Dashboard: avatars (public, 5MB, image/*); cvs (private, 10MB, pdf, doc, docx, json).
-- Run once; if buckets exist, skip or drop them first.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']
  ),
  (
    'cvs',
    'cvs',
    false,
    10485760,
    ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/json']
  );
