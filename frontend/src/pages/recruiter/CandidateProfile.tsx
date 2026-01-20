import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCandidateCV, downloadCandidateCV, getAllRecruiterApplications, updateApplicationStatus } from "@/services/api";
import type { CVExtractionResponse, JobApplication } from "@/types/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { MatchScore } from "@/components/shared/MatchScore";
import { SkillTag } from "@/components/shared/SkillTag";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Download,
  Briefcase,
  GraduationCap,
  Award,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function CandidateProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cvFileTimestamp = searchParams.get('cv_file_timestamp');
  const appliedAt = searchParams.get('applied_at');
  const applicationIdParam = searchParams.get('application_id');
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);

  // Log the parameters to debug
  console.log('[CandidateProfile] Component rendered:', {
    id,
    cvFileTimestamp,
    appliedAt,
    url: window.location.href,
    pathname: window.location.pathname,
  });

  // Fetch CV data using CV file timestamp (preferred) or applied_at (fallback), otherwise latest
  // Use a unique queryKey that includes "Profile" to avoid conflicts with pipeline queries
  const { data: cvData, isLoading: isLoadingCV, error: cvError } = useQuery<CVExtractionResponse>({
    queryKey: ["candidateCVProfile", id, cvFileTimestamp || appliedAt || "latest"],
    queryFn: async () => {
      console.log('[CandidateProfile] Fetching CV:', {
        candidateId: id,
        cvFileTimestamp: cvFileTimestamp || undefined,
        appliedAt: appliedAt || undefined,
        queryKey: ["candidateCVProfile", id, cvFileTimestamp || appliedAt || "latest"],
      });
      
      if (!id) {
        throw new Error("Candidate ID is required");
      }
      
      const result = await getCandidateCV(id, appliedAt || undefined, cvFileTimestamp || undefined);
      console.log('[CandidateProfile] CV fetched:', {
        candidateId: id,
        cvName: result?.cv_data?.identity?.full_name,
        cvFileTimestamp: cvFileTimestamp || undefined,
        appliedAt: appliedAt || undefined,
      });
      return result;
    },
    enabled: !!id,
    retry: false,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
    refetchOnMount: true, // Always refetch when component mounts
  });

  // Fetch applications to find the application ID if not provided
  const { data: applications = [] } = useQuery<JobApplication[]>({
    queryKey: ["recruiterApplications"],
    queryFn: () => getAllRecruiterApplications(),
    enabled: !applicationIdParam && !!id,
  });

  // Find application ID for this candidate
  const applicationId = applicationIdParam 
    ? parseInt(applicationIdParam, 10)
    : applications.find((app) => app.candidate.id === id)?.application_id;

  // Mutation for accepting candidate
  const acceptMutation = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: number; status: string }) =>
      updateApplicationStatus(applicationId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiterApplications"] });
      toast.success("Candidate accepted successfully");
      navigate("/recruiter/applications");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to accept candidate");
    },
  });

  // Extract data from CV
  const identity = cvData?.cv_data?.identity || {};
  const experience = cvData?.cv_data?.experience || [];
  const education = cvData?.cv_data?.education || [];
  const skills = cvData?.cv_data?.skills_analysis 
    ? [...(cvData.cv_data.skills_analysis.explicit_skills || []), ...(cvData.cv_data.skills_analysis.job_related_skills || [])]
    : [];
  const uniqueSkills = Array.from(new Set(skills));

  // Handle download CV
  const handleDownloadCV = async () => {
    if (!id) return;
    
    try {
      const blob = await downloadCandidateCV(
        id,
        appliedAt || undefined,
        cvFileTimestamp || undefined
      );
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${identity.full_name || 'CV'}_${cvFileTimestamp || 'latest'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("CV downloaded successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to download CV");
    }
  };

  // Handle accept candidate
  const handleAcceptCandidate = () => {
    if (!applicationId) {
      toast.error("Application ID not found");
      return;
    }
    
    acceptMutation.mutate({
      applicationId,
      status: "applied", // Set to "applied" status when accepting
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "shortlisted":
        return "bg-success/10 text-success border-success/30";
      case "reviewed":
        return "bg-primary/10 text-primary border-primary/30";
      case "new":
        return "bg-info/10 text-info border-info/30";
      default:
        return "";
    }
  };

  if (isLoadingCV) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (cvError || !cvData) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">CV Not Found</h3>
          <p className="text-muted-foreground">
            {cvError ? "Failed to load candidate CV" : "No CV data available for this candidate"}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Candidate Profile</h1>
          <p className="text-muted-foreground">
            {cvFileTimestamp ? "Viewing CV version from application time" : appliedAt ? "Viewing CV version at time of application" : "Viewing latest CV"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleDownloadCV}>
            <Download className="w-4 h-4" />
            Download CV
          </Button>
          <Button 
            className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            onClick={handleAcceptCandidate}
            disabled={!applicationId || acceptMutation.isPending}
          >
            <CheckCircle className="w-4 h-4" />
            Accept Candidate
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Avatar className="w-24 h-24 mx-auto mb-4">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {identity.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-bold">{identity.full_name || "Unknown"}</h2>
                <p className="text-muted-foreground">{identity.headline || "No headline"}</p>
              </div>

              <Separator className="my-6" />

              <div className="space-y-3">
                {identity.email && (
                  <a
                    href={`mailto:${identity.email}`}
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {identity.email}
                  </a>
                )}
                {identity.phone && (
                  <a
                    href={`tel:${identity.phone}`}
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {identity.phone}
                  </a>
                )}
                {identity.location && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {identity.location}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          {uniqueSkills.length > 0 && (
            <Card className="bg-gradient-to-br from-success/10 via-primary/5 to-accent/10 border-success/30 hover:border-success/50 transition-all">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-success to-primary flex items-center justify-center">
                    <Award className="w-4 h-4 text-primary-foreground" />
                  </div>
                  Skills & Expertise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(isSkillsExpanded ? uniqueSkills : uniqueSkills.slice(0, 5)).map((skill) => (
                    <SkillTag
                      key={skill}
                      skill={skill}
                    />
                  ))}
                </div>
                {uniqueSkills.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3 text-primary hover:text-primary/80"
                    onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
                  >
                    {isSkillsExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Show {uniqueSkills.length - 5} More
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          {identity.introduction && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Professional Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {identity.introduction}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Experience */}
          {experience.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {experience.map((exp, index) => (
                    <div key={index} className="relative pl-6 pb-6 last:pb-0">
                      {index !== experience.length - 1 && (
                        <div className="absolute left-[7px] top-3 bottom-0 w-[2px] bg-border" />
                      )}
                      <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-primary/10 border-2 border-primary" />
                      <div>
                        <h4 className="font-semibold">{exp.role || "Position"}</h4>
                        <p className="text-sm text-muted-foreground">
                          {exp.company || "Company"} • {exp.start_date && exp.end_date 
                            ? `${exp.start_date} - ${exp.end_date}`
                            : exp.start_date 
                            ? `${exp.start_date} - Present`
                            : "Dates not specified"}
                        </p>
                        {exp.responsibilities && exp.responsibilities.length > 0 && (
                          <ul className="text-sm mt-2 text-muted-foreground list-disc list-inside space-y-1">
                            {exp.responsibilities.map((resp, i) => (
                              <li key={i}>{resp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {education.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  Education
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {education.map((edu, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                      <div>
                        <h4 className="font-semibold">{edu.degree || "Degree"}</h4>
                        <p className="text-sm text-muted-foreground">
                          {edu.institution || "Institution"} • {edu.start_date && edu.end_date
                            ? `${edu.start_date} - ${edu.end_date}`
                            : edu.end_date
                            ? `Graduated ${edu.end_date}`
                            : edu.start_date
                            ? `Started ${edu.start_date}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}