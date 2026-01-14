# CV Bucket Setup Instructions

This guide explains how to set up the Supabase Storage bucket for CV files in the AI-Talent-Matcher application.

## Prerequisites

- Access to your Supabase project dashboard
- Admin permissions for the project

## Step-by-Step Instructions

### 1. Navigate to Storage

1. Log in to your Supabase dashboard
2. Go to **Storage** in the left sidebar
3. Click **New bucket** or **Create bucket**

### 2. Create the `cvs` Bucket

1. **Bucket name**: Enter `cvs` (exactly as shown, lowercase)
2. **Public bucket**: Set to **Private** (recommended for security)
   - CVs contain sensitive personal information
   - Access will be controlled via RLS policies
3. **File size limit**: Set to **10MB** (or higher if needed)
4. **Allowed MIME types**: 
   - `application/pdf`
   - `application/msword`
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - `application/json` (required for storing parsed CV data)
5. Click **Create bucket**

**Note**: If you've already created the bucket without `application/json`, you need to edit the bucket settings and add it to the allowed MIME types list.

### 3. Configure Bucket Policies (RLS)

After creating the bucket, you need to set up Row Level Security (RLS) policies:

#### Policy 1: Users can upload their own CVs

1. Go to **Storage** → **Policies** tab
2. Select the `cvs` bucket
3. Click **New Policy**
4. Choose **For full customization**
5. Policy name: `Users can upload their own CVs`
6. Allowed operation: `INSERT`
7. Policy definition:
```sql
(bucket_id = 'cvs'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
```
8. Click **Review** and then **Save policy**

#### Policy 2: Users can read their own CVs

1. Click **New Policy** again
2. Policy name: `Users can read their own CVs`
3. Allowed operation: `SELECT`
4. Policy definition:
```sql
(bucket_id = 'cvs'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
```
5. Click **Review** and then **Save policy**

#### Policy 3: Users can delete their own CVs (optional)

1. Click **New Policy** again
2. Policy name: `Users can delete their own CVs`
3. Allowed operation: `DELETE`
4. Policy definition:
```sql
(bucket_id = 'cvs'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
```
5. Click **Review** and then **Save policy**

### 4. Verify Bucket Structure

The bucket will automatically organize files in the following structure:

```
cvs/
├── {user_id_1}/
│   ├── raw/
│   │   └── {YYYYMMDD}_{HHMMSS}_{cv_name}.pdf
│   ├── parsed/
│   │   └── {YYYYMMDD}_{HHMMSS}_{cv_name}.json
│   └── match_results/
│       └── {YYYYMMDD}_{HHMMSS}_{cv_name}_{job_slug}.json
├── {user_id_2}/
│   └── ...
└── {user_id_n}/
    └── ...
```

This structure is created automatically when CVs are uploaded through the API.

## Testing the Setup

1. **Test Upload**: Try uploading a CV through the candidate Settings page
2. **Check Storage**: Go to Storage → `cvs` bucket and verify files are being created
3. **Check Permissions**: Try accessing another user's CV (should be denied)

## Troubleshooting

### Error: "Storage bucket 'cvs' not found"

- Verify the bucket name is exactly `cvs` (lowercase)
- Check that the bucket exists in your Supabase Storage dashboard

### Error: "Permission denied" or "Access denied"

- Verify RLS policies are correctly set up
- Check that the user is authenticated
- Ensure the policy conditions match the folder structure

### Error: "mime type application/json is not supported"

- **Solution**: Edit the `cvs` bucket settings in Supabase Storage dashboard
- Go to **Storage** → Select `cvs` bucket → Click **Settings** (or edit icon)
- Add `application/json` to the **Allowed MIME types** list
- Save the changes
- The system will retry the upload automatically

### Files not appearing in Storage

- Check that the service role key is correctly configured in `.env`
- Verify the bucket is not set to "Public" if you're using private access
- Check browser console and backend logs for detailed error messages

## Security Notes

- **Never** make the `cvs` bucket public
- Always use RLS policies to restrict access
- The folder structure (`{user_id}/...`) ensures users can only access their own files
- Consider adding additional policies for admin access if needed

## Next Steps

After setting up the bucket:

1. Test CV upload from the candidate portal
2. Verify files are stored correctly
3. Test CV extraction endpoint
4. Monitor storage usage and set up alerts if needed
