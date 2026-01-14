# Supabase Storage Setup for Match Results

## Overview
This document describes the Supabase Storage bucket structure needed for storing CV match analysis results.

## Bucket Configuration

### Bucket Name: `cvs`

The `cvs` bucket should already exist from the CV extraction setup. This document focuses on the `match_results/` folder structure within it.

## Folder Structure

```
cvs/
├── {user_id_1}/
│   ├── raw/                                    # Raw PDF files (existing)
│   │   ├── {YYYYMMDD}_{HHMMSS}_{cv_name}.pdf
│   ├── parsed/                                 # Parsed CV JSON files (existing)
│   │   ├── {YYYYMMDD}_{HHMMSS}_{cv_name}.json
│   └── match_results/                          # Match analysis results (NEW)
│       ├── {YYYYMMDD}_{HHMMSS}_{cv_name}_{job_slug}.json
│       └── {YYYYMMDD}_{HHMMSS}_{cv_name}_{job_slug}.json
├── {user_id_2}/
│   ├── raw/
│   ├── parsed/
│   └── match_results/
└── {user_id_n}/
    ├── raw/
    ├── parsed/
    └── match_results/
```

## File Naming Convention

**Match Results**: `cvs/{user_id}/match_results/{YYYYMMDD}_{HHMMSS}_{cv_name}_{job_slug}.json`
- Example: `cvs/user_123/match_results/20260111_143500_john_doe_resume_senior_data_scientist.json`
- `{YYYYMMDD}_{HHMMSS}`: Timestamp when match analysis was performed
- `{cv_name}`: Original CV filename (without extension)
- `{job_slug}`: Job title converted to lowercase with spaces replaced by underscores, truncated to 30 chars

## Storage Permissions

### RLS (Row Level Security) Policies

The storage bucket should have RLS policies that:
1. Allow users to read their own match results in `{user_id}/match_results/`
2. Allow users to write their own match results in `{user_id}/match_results/`
3. Allow service role to read/write all match results (for backend operations)

### Setting Up RLS Policies

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Storage** → **Buckets** in the Supabase Dashboard
2. Click on the `cvs` bucket
3. Navigate to the **"Policies"** tab
4. Click **"New Policy"** or **"Add Policy"**

##### Policy 1: Allow users to read their own match results
- **Policy name**: `Users can read own match results`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text AND (storage.foldername(name))[2] = 'match_results')
```

##### Policy 2: Allow users to write their own match results
- **Policy name**: `Users can write own match results`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'cvs' AND (storage.foldername(name))[1] = auth.uid()::text AND (storage.foldername(name))[2] = 'match_results')
```

##### Policy 3: Allow service role to manage all match results
- **Policy name**: `Service role can manage all match results`
- **Allowed operation**: `ALL` (SELECT, INSERT, UPDATE, DELETE)
- **Target roles**: `service_role`
- **Policy definition**:
```sql
(bucket_id = 'cvs' AND (storage.foldername(name))[2] = 'match_results')
```

#### Option B: Using SQL Editor

1. Go to **SQL Editor** in the Supabase Dashboard
2. Click **"New query"**
3. Paste the following SQL:

```sql
-- Policy 1: Allow authenticated users to read their own match results
CREATE POLICY "Users can read own match results"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.foldername(name))[2] = 'match_results'
);

-- Policy 2: Allow authenticated users to write their own match results
CREATE POLICY "Users can write own match results"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.foldername(name))[2] = 'match_results'
);

-- Policy 3: Allow service role to manage all match results (for backend operations)
CREATE POLICY "Service role can manage all match results"
ON storage.objects FOR ALL
TO service_role
USING (
  bucket_id = 'cvs' AND
  (storage.foldername(name))[2] = 'match_results'
);
```

4. Click **"Run"** to execute the SQL

### Policy Explanation

- **`(storage.foldername(name))[1]`**: Extracts the first folder name from the path, which is the `user_id`
- **`(storage.foldername(name))[2]`**: Extracts the second folder name, which should be `match_results`
- **`auth.uid()::text`**: Gets the current authenticated user's ID as text
- **`auth.role() = 'service_role'`**: Checks if the request is from the service role (backend operations)

These policies ensure:
- Users can only access match results in their own `{user_id}/match_results/` folder
- The backend service role can access all match results for processing
- Match results are isolated per user for security

## MIME Types

The bucket should allow the following MIME types:
- `application/json` (for match result JSON files)
- `application/pdf` (for raw CV PDFs - already configured)

## Notes

- Match results are stored as JSON files containing the full analysis breakdown
- Files are versioned by timestamp (no overwrites)
- Each match analysis creates a new file
- The match score is also stored in the `applications` table for quick access
- Match results can be retrieved for historical analysis or debugging

## Verification

After creating the policies, verify they are active:

1. Go to **Storage** → **Buckets** → `cvs` → **Policies** tab
2. You should see all 3 policies listed:
   - ✅ `Users can read own match results` (SELECT, authenticated)
   - ✅ `Users can write own match results` (INSERT, authenticated)
   - ✅ `Service role can manage all match results` (ALL, service_role)
3. Ensure all policies are **enabled** (not disabled)

## Troubleshooting

### If match results cannot be stored:
- Verify the `cvs` bucket exists and is accessible
- Check that Policy 2 (write) and Policy 3 (service role) are enabled
- Ensure the bucket allows `application/json` MIME type
- Verify the service role has proper permissions

### If users cannot read their match results:
- Check that Policy 1 (read) is enabled
- Verify the user is authenticated (`auth.uid()` is not null)
- Ensure the file path matches the pattern: `{user_id}/match_results/{filename}.json`

### If service role operations fail:
- Verify Policy 3 is enabled and targets `service_role`
- Check that the backend is using the service role key (not anon key)
- Ensure the bucket name is exactly `cvs` (lowercase)

## Implementation Status

✅ Match results folder structure is created automatically by the storage service
✅ Files are stored with proper naming convention
✅ Match score is stored in `applications.match_score` column for quick access
✅ Background calculation triggers when candidate applies to a job
