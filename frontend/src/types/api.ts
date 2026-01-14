// API Types matching FastAPI schemas

// Auth Types
export interface CandidateSignupRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  location?: string;
}

export interface RecruiterSignupRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  company_name: string;
  company_size?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface PasswordResetRequest {
  email: string;
  new_password: string;
  confirm_password: string;
}

export interface PasswordResetResponse {
  status: string;
  message: string;
}

// Profile Types
export interface Profile {
  id: string;
  full_name: string;
  role: 'recruiter' | 'candidate';
  role_title?: string;
  phone?: string;
  avatar_url?: string;
  candidate_profile?: {
    location?: string;
    last_upload_file?: string;
  };
  recruiter_profile?: {
    company_name: string;
    company_size?: string;
  };
}

export interface ProfileUpdate {
  full_name?: string;
  role?: 'recruiter' | 'candidate';
  role_title?: string;
  avatar_url?: string;
}

export interface CandidateProfileUpdate {
  location?: string;
  last_upload_file?: string;
}

export interface RecruiterProfileUpdate {
  company_name?: string;
  company_size?: string;
}

// Job Types
export interface JobCreate {
  job_title: string;
  job_description?: string;
  job_requirements?: string;
  job_skills?: string;
  location?: string;
  employment_type?: string;
  optional_salary?: number;
  optional_salary_max?: number;
  closing_date?: string; // ISO date string
  sprint_duration?: string;
  status?: string;
}

export interface JobUpdate {
  job_title?: string;
  job_description?: string;
  job_requirements?: string;
  job_skills?: string;
  location?: string;
  employment_type?: string;
  optional_salary?: number;
  optional_salary_max?: number;
  closing_date?: string; // ISO date string
  sprint_duration?: string;
  status?: string;
}

export interface JobPosition {
  id: number;
  job_title: string;
  job_description?: string;
  job_requirements?: string;
  job_skills?: string;
  location?: string;
  employment_type?: string;
  optional_salary?: number;
  optional_salary_max?: number;
  closing_date?: string;
  sprint_duration?: string;
  recruiter_profile_id: string;
  status: 'open' | 'closed' | 'draft';
  created_at: string;
  company_name?: string;
  application_count?: number; // Total number of applications (all statuses)
}

// Application Types
export interface ApplicationCreate {
  job_position_id: number;
  cover_letter?: string;
}

export interface Application {
  id: number;
  candidate_profile_id?: string;
  job_position_id: number;
  status: 'applied' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired' | 'withdrawn' | 'interview';
  cover_letter?: string;
  applied_at: string;
  updated_at: string;
  start_date?: string;
  job_title?: string;
  job_description?: string;
  job_requirements?: string;
  job_skills?: string;
  location?: string;
  employment_type?: string;
  optional_salary?: number;
  optional_salary_max?: number;
  closing_date?: string;
  job_created_at?: string;
  company_name?: string;
}

export interface JobApplication {
  cv_file_timestamp?: string; // CV file timestamp (YYYYMMDD_HHMMSS) stored when candidate applied
  cv_file_path?: string; // CV file path stored when candidate applied
  application_id: number;
  status: string;
  display_status?: string; // UI-friendly status: "new", "reviewed", "shortlisted", "accepted", "rejected"
  applied_at: string;
  cover_letter?: string;
  job_position_id?: number;
  job_title?: string;
  start_date?: string; // Start date for hired candidates (ISO date string)
  candidate: {
    id: string;
    full_name: string;
    location?: string;
    last_upload_file?: string; // Last CV file uploaded by candidate
  };
}

// CV Extraction Types
export interface CVExtractionResponse {
  status: string;
  cv_data: {
    metadata: {
      extraction_date: string;
      extraction_time: string;
      extraction_datetime: string;
    };
    identity: {
      full_name?: string;
      headline?: string;
      introduction?: string;
      email?: string;
      phone?: string;
      location?: string;
    };
    experience: Array<{
      company?: string;
      role?: string;
      responsibilities: string[];
      start_date?: string;
      end_date?: string;
    }>;
    education: Array<{
      institution?: string;
      degree?: string;
      start_date?: string;
      end_date?: string;
      certifications: string[];
      academic_projects: string[];
    }>;
    projects: string[];
    certifications: string[];
    skills_analysis: {
      explicit_skills: string[];
      related_roles: string[];
      job_related_skills: string[];
    };
  };
  metadata: {
    extraction_date: string;
    extraction_time: string;
    extraction_datetime: string;
  };
  storage_paths: {
    raw: string;
    parsed: string;
  };
}

// CV Update Types
export interface CVUpdateRequest {
  full_name?: string;
  headline?: string;
  introduction?: string;
  email?: string;
  phone?: string;
  location?: string;
  selected_skills?: string[];
}

export interface CVUpdateResponse {
  status: string;
  message: string;
  storage_path: string;
}

