# Verification Guide: Match Analysis Functionality

## Overview
The match analysis feature automatically calculates a match score when a candidate applies to a job. The score is calculated in the background and stored in the `applications.match_score` column.

## How It Works

1. **Candidate applies to a job** → Application is created immediately
2. **Background thread starts** → Match score calculation begins (non-blocking)
3. **Match analysis runs** → All agents process CV vs job requirements
4. **Score is calculated** → Weighted final score (0.0-1.0)
5. **Score is saved** → Updated in `applications.match_score` column
6. **UI updates** → Candidate Pipeline shows the score when available

## Verification Steps

### 1. Check Backend Logs

When a candidate applies to a job, you should see these log messages in the backend console:

```
INFO: Application successfully created/updated. Response data length: 1
INFO: Background match score calculation started for application {application_id}
INFO: Starting background match score calculation for application {application_id}
INFO: Calculating match score for user {user_id} and job {job_position_id}
INFO: Analyzing education match...
INFO: Analyzing experience match...
INFO: Analyzing projects match...
INFO: Analyzing certifications match...
INFO: Analyzing skills match...
INFO: Match score calculation complete. Final score: {final_score}
INFO: Match score {final_score} saved for application {application_id}
```

**What to look for:**
- ✅ "Background match score calculation started" - confirms the background task was triggered
- ✅ "Calculating match score" - confirms the calculation started
- ✅ "Match score calculation complete" - confirms the calculation finished
- ✅ "Match score {score} saved" - confirms the score was saved to database

**If you see errors:**
- ❌ "No CV data found" - candidate needs to upload a CV first
- ❌ "Error calculating match score" - check the full error message for details
- ❌ "Job {id} not found" - the job position might have been deleted

### 2. Check Database

Query the `applications` table to verify match scores are being stored:

```sql
-- Check applications with match scores
SELECT 
    id,
    candidate_profile_id,
    job_position_id,
    status,
    match_score,
    applied_at,
    updated_at
FROM applications
WHERE match_score IS NOT NULL
ORDER BY applied_at DESC
LIMIT 10;
```

**Expected results:**
- `match_score` should be a number between 0.0 and 1.0
- Recent applications should have `match_score` populated (may take a few seconds after application)
- Older applications might have `NULL` if they were created before the feature was implemented

### 3. Check UI - Candidate Pipeline

1. **Navigate to Recruiter Portal** → **Candidate Pipeline**
2. **Look for match scores** on candidate cards (left side, circular progress indicator)
3. **Expected behavior:**
   - ✅ **If score is calculated**: Shows percentage (0-100%) with colored circle
   - ⏳ **If score is calculating**: Shows "Calculating..." placeholder
   - ❌ **If no CV uploaded**: Score will be 0 or show "Calculating..."

**Visual indicators:**
- **Green circle (85-100%)**: Excellent match
- **Blue circle (70-84%)**: Good match
- **Yellow circle (50-69%)**: Moderate match
- **Red circle (0-49%)**: Low match

### 4. Test the Flow End-to-End

#### Step 1: Prepare Test Data
1. **As a candidate:**
   - Upload a CV (if not already uploaded)
   - Navigate to Job Search
   - Find a job to apply to

#### Step 2: Apply to Job
1. **Click "Apply"** on a job
2. **Check backend logs** - should see:
   ```
   INFO: Background match score calculation started for application {id}
   ```

#### Step 3: Wait for Calculation
1. **Wait 10-30 seconds** (depending on CV complexity and LLM response time)
2. **Check backend logs** - should see:
   ```
   INFO: Match score calculation complete. Final score: {score}
   INFO: Match score {score} saved for application {id}
   ```

#### Step 4: Verify in UI
1. **As a recruiter:**
   - Navigate to **Candidate Pipeline**
   - **Refresh the page** (or wait for auto-refresh)
   - **Look for the candidate** who just applied
   - **Check the match score** - should show a percentage

### 5. Manual Verification via API

You can also manually trigger a match analysis using the API endpoint:

```bash
# POST /cv/match
curl -X POST "http://localhost:8000/cv/match" \
  -H "Authorization: Bearer {your_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "job_position_id": 1,
    "cv_timestamp": null
  }'
```

**Expected response:**
```json
{
  "final_score": 0.75,
  "component_scores": {
    "education": 0.8,
    "experience": 0.7,
    "projects": 0.6,
    "certifications": 0.5,
    "skills": 0.9
  },
  "component_weights": {
    "education": 0.2,
    "experience": 0.4,
    "projects": 0.2,
    "certifications": 0.1,
    "skills": 0.1
  },
  "component_results": { ... },
  "score_breakdown": { ... },
  "metadata": { ... }
}
```

## Troubleshooting

### Issue: Match scores not appearing in UI

**Possible causes:**
1. **Calculation still in progress** - Wait 30-60 seconds and refresh
2. **No CV uploaded** - Candidate needs to upload a CV first
3. **Background task failed** - Check backend logs for errors
4. **Database column missing** - Run the migration: `docs/migrations/add_match_score_to_applications.sql`

**Solution:**
- Check backend logs for errors
- Verify the candidate has uploaded a CV
- Check database to see if `match_score` column exists
- Verify the migration was run

### Issue: Match scores always show 0 or "Calculating..."

**Possible causes:**
1. **Background task not starting** - Check if thread is being created
2. **Calculation failing silently** - Check backend logs for exceptions
3. **CV data not found** - Verify CV was uploaded and parsed correctly

**Solution:**
- Check backend logs for "Starting background match score calculation"
- Look for any error messages in the logs
- Verify CV exists in Supabase Storage: `cvs/{user_id}/parsed/`

### Issue: Match scores are NULL in database

**Possible causes:**
1. **Calculation not triggered** - Application might have existed before feature was added
2. **Background task failed** - Check logs for errors
3. **Migration not run** - `match_score` column might not exist

**Solution:**
- Run the migration if not already done
- Check backend logs for calculation errors
- Manually trigger calculation via API endpoint for existing applications

## Performance Considerations

- **Calculation time**: Typically 10-30 seconds per application
- **Background processing**: Does not block application creation
- **Token optimization**: Match score is calculated **ONCE** when candidate applies and stored in database
- **No recalculation**: If `match_score` already exists, calculation is skipped to avoid wasting LLM tokens
- **Retrieval only**: When loading Candidate Pipeline, the stored score is retrieved from database (no recalculation)
- **Concurrent calculations**: Multiple applications can be processed simultaneously

## Token Optimization

The system is optimized to avoid wasting LLM tokens:

1. **One-time calculation**: Match score is calculated only when a candidate first applies to a job
2. **Stored permanently**: The final score (0.0-1.0) is stored in `applications.match_score` column
3. **Retrieval only**: When the Candidate Pipeline loads, it retrieves the stored score from the database
4. **Skip if exists**: If `match_score` already exists, the background calculation is skipped entirely
5. **Race condition protection**: Double-check ensures we don't calculate if another thread already calculated it

**Flow:**
- Candidate applies → Check if `match_score` exists
  - If **NULL**: Trigger background calculation → Store result → Done
  - If **exists**: Skip calculation → Use stored value → Done
- Page loads → Retrieve `match_score` from database → Display (no calculation)

## Quick Verification Checklist

- [ ] Backend starts without import errors
- [ ] Candidate applies to a job → See "Background match score calculation started" in logs
- [ ] Within 30 seconds → See "Match score calculation complete" in logs
- [ ] Database shows `match_score` populated for the application
- [ ] Candidate Pipeline UI shows match score (or "Calculating..." if still processing)
- [ ] Match score updates automatically (page auto-refreshes every 10 seconds)

## Next Steps

Once verified, you can:
1. **Sort candidates by match score** in Candidate Pipeline (already implemented)
2. **Filter candidates** by match score threshold
3. **View detailed breakdown** of match components (future enhancement)
4. **Re-calculate scores** if job requirements change (future enhancement)
