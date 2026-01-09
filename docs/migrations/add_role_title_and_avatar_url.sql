-- Migration: Add role_title and avatar_url columns to profiles table
-- Description: Adds optional columns for job title and profile picture
-- Date: 2024
-- Safe to run: Yes - columns are nullable and don't affect existing functionality

-- Add role_title column (for job title like "HR Manager", "Software Developer")
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role_title TEXT NULL;

-- Add comment to role_title column
COMMENT ON COLUMN public.profiles.role_title IS 'Job title or position of the user (e.g., HR Manager, Software Developer)';

-- Add avatar_url column (for profile picture URL)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;

-- Add comment to avatar_url column
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL of the user profile picture/avatar stored in Supabase Storage';
