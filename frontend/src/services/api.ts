// API service functions for all FastAPI endpoints

import apiClient from '@/lib/api';
import type {
  CandidateSignupRequest,
  RecruiterSignupRequest,
  LoginRequest,
  AuthResponse,
  PasswordResetRequest,
  PasswordResetResponse,
  Profile,
  ProfileUpdate,
  CandidateProfileUpdate,
  RecruiterProfileUpdate,
  JobCreate,
  JobUpdate,
  JobPosition,
  ApplicationCreate,
  Application,
  JobApplication,
  CVExtractionResponse,
  CVUpdateRequest,
  CVUpdateResponse,
} from '@/types/api';

// Authentication Services
export const signupCandidate = async (data: CandidateSignupRequest): Promise<AuthResponse> => {
  const { data: response } = await apiClient.post<AuthResponse>('/auth/signup/candidate', data);
  return response;
};

export const signupRecruiter = async (data: RecruiterSignupRequest): Promise<AuthResponse> => {
  const { data: response } = await apiClient.post<AuthResponse>('/auth/signup/recruiter', data);
  return response;
};

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const { data: response } = await apiClient.post<AuthResponse>('/auth/login', data);
  return response;
};

export const resetPassword = async (data: PasswordResetRequest): Promise<PasswordResetResponse> => {
  const { data: response } = await apiClient.post<PasswordResetResponse>('/auth/reset-password', data);
  return response;
};

// Profile Services
export const getCurrentUser = async (): Promise<Profile> => {
  const { data } = await apiClient.get<Profile>('/me');
  return data;
};

export const updateProfile = async (data: ProfileUpdate): Promise<{ status: string; data: Profile }> => {
  const { data: response } = await apiClient.patch<{ status: string; data: Profile }>('/profiles/me', data);
  return response;
};

export const uploadAvatar = async (file: File): Promise<{ status: string; avatar_url: string; profile: Profile }> => {
  const formData = new FormData();
  formData.append('file', file);
  // Don't set Content-Type header - let the browser set it with the correct boundary
  const { data } = await apiClient.post<{ status: string; avatar_url: string; profile: Profile }>(
    '/profiles/me/avatar',
    formData
  );
  return data;
};

export const updateCandidateProfile = async (data: CandidateProfileUpdate): Promise<{ status: string }> => {
  const { data: response } = await apiClient.patch<{ status: string }>('/candidate-profiles/me', data);
  return response;
};

export const updateRecruiterProfile = async (data: RecruiterProfileUpdate): Promise<{ status: string }> => {
  const { data: response } = await apiClient.patch<{ status: string }>('/recruiter-profiles/me', data);
  return response;
};

// Job Services
export const getOpenJobs = async (): Promise<JobPosition[]> => {
  const { data } = await apiClient.get<JobPosition[]>('/jobs');
  return data;
};

export const createJob = async (jobData: JobCreate): Promise<JobPosition> => {
  const { data } = await apiClient.post<JobPosition>('/jobs', jobData);
  return data;
};

export const getMyJobs = async (): Promise<JobPosition[]> => {
  const { data } = await apiClient.get<JobPosition[]>('/jobs/me');
  return data;
};

export const getJob = async (jobId: number): Promise<JobPosition> => {
  const { data } = await apiClient.get<JobPosition>(`/jobs/${jobId}`);
  return data;
};

export const updateJob = async (jobId: number, jobData: JobUpdate): Promise<JobPosition> => {
  const { data } = await apiClient.patch<JobPosition>(`/jobs/${jobId}`, jobData);
  return data;
};

export const deleteJob = async (jobId: number): Promise<{ message: string; job_id: number }> => {
  const { data } = await apiClient.delete<{ message: string; job_id: number }>(`/jobs/${jobId}`);
  return data;
};

// Application Services
export const applyToJob = async (data: ApplicationCreate): Promise<Application> => {
  const { data: response } = await apiClient.post<Application>('/applications', data);
  return response;
};

export const getMyApplications = async (): Promise<Application[]> => {
  const { data } = await apiClient.get<Application[]>('/applications/me');
  return data;
};

export const updateApplicationStatus = async (
  applicationId: number,
  status: string
): Promise<{ application_id: number; status: string }> => {
  const { data } = await apiClient.patch<{ application_id: number; status: string }>(
    `/applications/${applicationId}/status?status=${status}`
  );
  return data;
};

export const withdrawApplication = async (applicationId: number): Promise<{ status: string }> => {
  const { data } = await apiClient.patch<{ status: string }>(`/applications/${applicationId}/withdraw`);
  return data;
};

export const getJobApplications = async (jobId: number): Promise<JobApplication[]> => {
  const { data } = await apiClient.get<JobApplication[]>(`/applications/job/${jobId}`);
  return data;
};

export const getAllRecruiterApplications = async (jobId?: number): Promise<JobApplication[]> => {
  const url = jobId 
    ? `/applications/recruiter/applications?job_id=${jobId}`
    : '/applications/recruiter/applications';
  const { data } = await apiClient.get<JobApplication[]>(url);
  return data;
};

// LLM Agent Services
export const generateJobDescription = async (payload: {
  job_title: string;
  employment_type: string;
  context?: string;
}): Promise<{ description: string }> => {
  const { data } = await apiClient.post<{ description: string }>('/llm/job-description', payload);
  return data;
};

export const generateRequirements = async (payload: {
  job_description: string;
  employment_type: string;
}): Promise<{ requirements: string }> => {
  const { data } = await apiClient.post<{ requirements: string }>('/llm/requirements', payload);
  return data;
};

export const generateSkills = async (payload: {
  job_description: string;
  requirements: string;
}): Promise<{ skills: string[] }> => {
  const { data } = await apiClient.post<{ skills: string[] }>('/llm/skills', payload);
  return data;
};

// CV Services
export const uploadCV = async (file: File): Promise<CVExtractionResponse> => {
  console.log('uploadCV called with file:', file.name, file.size, file.type);
  const formData = new FormData();
  formData.append('file', file);
  console.log('FormData created, posting to /cv/extract');
  try {
    const { data } = await apiClient.post<CVExtractionResponse>('/cv/extract', formData);
    console.log('CV upload response received:', data);
    return data;
  } catch (error) {
    console.error('Error in uploadCV:', error);
    throw error;
  }
};

export const updateCV = async (updates: CVUpdateRequest): Promise<CVUpdateResponse> => {
  const { data } = await apiClient.patch<CVUpdateResponse>('/cv/update', updates);
  return data;
};

export const getLatestCV = async (): Promise<CVExtractionResponse> => {
  const { data } = await apiClient.get<CVExtractionResponse>('/cv/latest');
  return data;
};

export const getCandidateCV = async (
  candidateId: string,
  appliedAt?: string,
  cvFileTimestamp?: string
): Promise<CVExtractionResponse> => {
  const params = new URLSearchParams();
  if (cvFileTimestamp) {
    params.set('cv_file_timestamp', cvFileTimestamp);
  } else if (appliedAt) {
    params.set('applied_at', appliedAt);
  }
  const queryString = params.toString();
  const { data } = await apiClient.get<CVExtractionResponse>(
    `/cv/candidate/${candidateId}${queryString ? `?${queryString}` : ''}`
  );
  return data;
};

export const updateApplicationStartDate = async (
  applicationId: number,
  startDate: string
): Promise<{ application_id: number; start_date: string }> => {
  const { data } = await apiClient.patch<{ application_id: number; start_date: string }>(
    `/applications/${applicationId}/start-date`,
    { start_date: startDate }
  );
  return data;
};

export const removeHiredCandidate = async (
  applicationId: number
): Promise<{ status: string }> => {
  const { data } = await apiClient.patch<{ status: string }>(
    `/applications/${applicationId}/remove-hired`
  );
  return data;
};
