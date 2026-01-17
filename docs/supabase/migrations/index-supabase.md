# Supabase Migrations Index

This index lists all SQL migrations to reproduce the AI Talent Matcher Supabase setup from scratch. Run them in **numeric order** in the **Supabase SQL Editor** (or via `psql` with the project's DB connection string).

---

## Run order

| # | File | Description |
|---|------|-------------|
| 1 | [001_extensions.sql](../migrations/001_extensions.sql) | Enable `uuid-ossp` and `pgcrypto`. Optional: `pg_graphql`, `pg_stat_statements`, `supabase_vault`. |
| 2 | [002_table_profiles.sql](../migrations/002_table_profiles.sql) | Create `profiles` (id, full_name, role, phone, avatar_url, role_title). FK to `auth.users`. |
| 3 | [003_table_candidate_profiles.sql](../migrations/003_table_candidate_profiles.sql) | Create `candidate_profiles` (profile_id, location, last_upload_file). FK to `profiles`. |
| 4 | [004_table_recruiter_profiles.sql](../migrations/004_table_recruiter_profiles.sql) | Create `recruiter_profiles` (profile_id, company_name, company_size). FK to `profiles`. |
| 5 | [005_table_job_position.sql](../migrations/005_table_job_position.sql) | Create `job_position` (title, description, requirements, skills, location, employment_type, salary, status, etc.). FK to `recruiter_profiles`. |
| 6 | [006_table_applications.sql](../migrations/006_table_applications.sql) | Create `applications` (candidate, job, status, cover_letter, cv_file_*, match_score, start_date). FKs to `candidate_profiles` and `job_position`. |
| 7 | [007_indexes.sql](../migrations/007_indexes.sql) | Index `idx_applications_match_score` on `applications(match_score DESC NULLS LAST)`. |
| 8 | [008_rls_public.sql](../migrations/008_rls_public.sql) | Enable RLS and create policies for `profiles`, `candidate_profiles`, `recruiter_profiles`, `job_position`, `applications`. |
| 9 | [009_storage_buckets.sql](../migrations/009_storage_buckets.sql) | Create buckets `avatars` (public, 5MB, images) and `cvs` (private, 10MB, pdf/doc/docx/json). If `storage.buckets.id` is UUID, create these in the Dashboard instead. |
| 10 | [010_storage_policies.sql](../migrations/010_storage_policies.sql) | RLS on `storage.objects` for avatars, cvs, and `cvs/…/match_results/`. |

---

## Auth (manual)

Auth is driven by the FastAPI backend (signup/login). Configure in **Supabase Dashboard → Authentication**:

- **Providers**: enable Email (and others if needed).
- **URL Configuration**: set Site URL and Redirect URLs for your app.
- **Email templates**: optional; confirm, reset, magic link.

`profiles.id` references `auth.users(id)`. Inserts into `profiles` and role-specific profiles are done with the **service role** at signup.

---

## Storage layout

- **avatars**: `{user_id}/…` — profile images. Public bucket; RLS limits write/update/delete to owner.
- **cvs**: `{user_id}/raw/`, `{user_id}/parsed/`, `{user_id}/match_results/` — CVs and match analysis. Private; RLS limits access to owner and service role for `match_results`.

---

## Related docs

- [RLS overview](rls.md) — intent and invariants for RLS.
- [CV bucket setup](../cv_bucket_setup.md) — `cvs` bucket and policies.
- [Supabase storage setup (avatars)](../supabase_storage_setup_step_by_step.md) — `avatars` bucket.
- [Match results storage](../supabase_storage_match_results_setup.md) — `cvs/…/match_results/` and policies.
