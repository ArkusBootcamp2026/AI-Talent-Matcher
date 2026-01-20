import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MatchScore } from "@/components/shared/MatchScore";
import { SkillTag } from "@/components/shared/SkillTag";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Filter,
  Eye,
  MapPin,
  Briefcase,
  GraduationCap,
  ArrowUpDown,
  UserCheck,
  XCircle,
  FileText,
  Heart,
} from "lucide-react";
import { getAllRecruiterApplications, updateApplicationStatus, getCandidateCV } from "@/services/api";
import type { JobApplication, CVExtractionResponse } from "@/types/api";

export default function CandidatePipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("match-desc");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedCandidates, setSavedCandidates] = useState<string[]>([]);

  const { data: applications = [], isLoading } = useQuery<JobApplication[]>({
    queryKey: ["recruiterApplications"],
    queryFn: () => getAllRecruiterApplications(),
    refetchInterval: 10000, // Auto-refresh every 10 seconds to show updated match scores
  });

  // Load saved candidates from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("recruiter_saved_candidates");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedCandidates(parsed);
        }
      } catch (error) {
        console.error("Failed to parse saved candidates from localStorage", error);
      }
    }
  }, []);

  // Save to localStorage whenever savedCandidates changes
  useEffect(() => {
    localStorage.setItem("recruiter_saved_candidates", JSON.stringify(savedCandidates));
  }, [savedCandidates]);

  const toggleSaveCandidate = (candidateId: string) => {
    setSavedCandidates((prev) => {
      if (prev.includes(candidateId)) {
        return prev.filter((id) => id !== candidateId);
      } else {
        return [...prev, candidateId];
      }
    });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: number; status: string }) =>
      updateApplicationStatus(applicationId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiterApplications"] });
      // Also invalidate CV queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["candidateCV"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-info/10 text-info border-info/30";
      case "reviewed":
        return "bg-primary/10 text-primary border-primary/30";
      case "shortlisted":
        return "bg-success/10 text-success border-success/30";
      case "accepted":
        return "bg-success/20 text-success border-success/50";
      case "rejected":
        return "bg-destructive/10 text-destructive border-destructive/30";
      default:
        return "";
    }
  };

  const handleViewProfile = (candidateId: string, cvFileTimestamp?: string, appliedAt?: string) => {
    // Navigate to candidate profile with CV file timestamp (preferred) or applied_at (fallback)
    // CV file timestamp is the exact file that was active when candidate applied
    console.log('[View Profile] Navigating to candidate profile:', {
      candidateId,
      cvFileTimestamp,
      appliedAt,
      url: `/recruiter/candidates/${candidateId}${cvFileTimestamp ? `?cv_file_timestamp=${cvFileTimestamp}` : appliedAt ? `?applied_at=${appliedAt}` : ''}`,
    });
    
    const params = new URLSearchParams();
    if (cvFileTimestamp) {
      params.set('cv_file_timestamp', cvFileTimestamp);
    } else if (appliedAt) {
      params.set('applied_at', appliedAt);
    }
    navigate(`/recruiter/candidates/${candidateId}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleReject = (applicationId: number) => {
    updateStatusMutation.mutate({
      applicationId,
      status: "rejected",
    });
  };

  const handleAccept = (applicationId: number) => {
    updateStatusMutation.mutate({
      applicationId,
      status: "applied", // Set to "applied" status when accepting (default status for accepted candidates)
    });
    // Navigate to ManageApplications page to show the accepted candidate
    navigate("/recruiter/applications");
  };

  const formatAppliedDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      return format(date, "MMM d, yyyy");
    } catch {
      return "";
    }
  };

  const toTitleCase = (str: string): string => {
    if (!str) return str;
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const parseSkills = (skillsString: string | null | undefined): string[] => {
    if (!skillsString) return [];
    return skillsString.split(",").map((s) => s.trim()).filter(Boolean);
  };

  // Truncate text at word boundaries to prevent UI overflow
  const truncateAtWordBoundary = (text: string, maxLength: number): string => {
    if (!text || text.length <= maxLength) return text;
    
    // Find the last space before maxLength
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    // If we found a space, truncate there; otherwise truncate at maxLength
    if (lastSpace > 0) {
      return truncated.substring(0, lastSpace);
    }
    return truncated;
  };

  // Clean text by removing trailing punctuation (commas, periods, etc.)
  const cleanText = (text: string): string => {
    if (!text) return text;
    // Remove trailing commas, periods, and other punctuation
    return text.replace(/[,.\s]+$/, '').trim();
  };

  // Extract text before the first comma (for education - show only degree, omit institution)
  const extractBeforeComma = (text: string): string => {
    if (!text) return text;
    const commaIndex = text.indexOf(',');
    if (commaIndex > 0) {
      return cleanText(text.substring(0, commaIndex));
    }
    return cleanText(text);
  };

  // Fetch CV data for all candidates
  const candidateIds = useMemo(() => {
    return applications.map((app) => app.candidate.id).filter(Boolean);
  }, [applications]);

  // Use useQueries to fetch CV data for all candidates
  const cvQueries = useQueries({
    queries: candidateIds.map((candidateId) => ({
      queryKey: ["candidateCV", candidateId],
      queryFn: () => getCandidateCV(candidateId),
      enabled: !!candidateId,
      retry: false,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      // Don't throw on 404 - candidate might not have uploaded CV yet
      throwOnError: false,
    })),
  });

  // Track CV loading state - check if any CV queries are still loading
  const isLoadingCVs = useMemo(() => {
    return cvQueries.some((query) => query.isLoading || query.isFetching);
  }, [cvQueries]);

  // Show initial loading state only when applications are loading
  // CV loading will be handled with skeletons
  const isInitialLoading = isLoading && applications.length === 0;

  // Create a map of candidate ID to CV data
  const cvDataMap = useMemo(() => {
    const map = new Map<string, CVExtractionResponse>();
    candidateIds.forEach((candidateId, index) => {
      const query = cvQueries[index];
      if (query.data) {
        map.set(candidateId, query.data);
      }
    });
    return map;
  }, [candidateIds, cvQueries]);

  // Calculate years of experience from experience entries
  const calculateYearsOfExperience = (experiences: Array<{ start_date?: string; end_date?: string }>): string => {
    if (!experiences || experiences.length === 0) return "N/A";
    
    try {
      const now = new Date();
      let totalMonths = 0;
      
      for (const exp of experiences) {
        if (!exp.start_date) continue;
        
        const startDate = parseISO(exp.start_date);
        const endDate = exp.end_date ? parseISO(exp.end_date) : now;
        
        if (startDate && endDate) {
          const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
          totalMonths += Math.max(0, months);
        }
      }
      
      if (totalMonths === 0) return "N/A";
      
      const years = Math.floor(totalMonths / 12);
      if (years === 0) {
        return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
      }
      return `${years} year${years !== 1 ? 's' : ''}`;
    } catch {
      return "N/A";
    }
  };

  // Transform applications to candidate-like structure for display
  const candidates = useMemo(() => {
    return applications.map((app) => {
      const cvData = cvDataMap.get(app.candidate.id);
      
      // Extract name from CV (priority) or application
      const rawName = cvData?.cv_data?.identity?.full_name || app.candidate.full_name || "Unknown";
      // Convert to Title Case (Camel Case) to avoid all uppercase
      const name = toTitleCase(rawName);
      
      // Use match_score from application (0.0 to 1.0), convert to percentage (0-100)
      // If match_score is not available yet (NULL), it means calculation is in progress
      // If match_score is 0.0, it means calculated but score is 0%
      // Ensure it's always a whole number (no decimals)
      const matchScore = app.match_score !== undefined && app.match_score !== null 
        ? Math.round(Number(app.match_score) * 100) 
        : null; // null means not calculated yet, 0 means calculated as 0%
      
      // Extract career/current role - from headline or latest experience role
      let career = "";
      if (cvData?.cv_data?.identity?.headline) {
        career = cvData.cv_data.identity.headline;
      } else if (cvData?.cv_data?.experience && Array.isArray(cvData.cv_data.experience) && cvData.cv_data.experience.length > 0) {
        const latestExp = cvData.cv_data.experience[0];
        career = latestExp.role || "";
      }
      
      // Extract latest work experience role for briefcase display
      let currentRole = "N/A";
      if (cvData?.cv_data?.experience && Array.isArray(cvData.cv_data.experience) && cvData.cv_data.experience.length > 0) {
        const latestExp = cvData.cv_data.experience[0];
        if (latestExp.role) {
          currentRole = latestExp.role;
        }
      }
      
      // Extract skills from CV data
      let skills: string[] = [];
      if (cvData?.cv_data?.skills_analysis) {
        const explicitSkills = cvData.cv_data.skills_analysis.explicit_skills || [];
        const jobRelatedSkills = cvData.cv_data.skills_analysis.job_related_skills || [];
        const allSkillsSet = new Set([...explicitSkills, ...jobRelatedSkills]);
        skills = Array.from(allSkillsSet);
      }

      // Calculate years of experience
      const experienceYears = cvData?.cv_data?.experience 
        ? calculateYearsOfExperience(cvData.cv_data.experience)
        : "N/A";

      // Extract education summary
      let education = "N/A";
      if (cvData?.cv_data?.education && Array.isArray(cvData.cv_data.education) && cvData.cv_data.education.length > 0) {
        const latestEdu = cvData.cv_data.education[0];
        if (latestEdu.degree && latestEdu.institution) {
          education = `${latestEdu.degree}, ${latestEdu.institution}`;
        } else if (latestEdu.degree) {
          education = latestEdu.degree;
        } else if (latestEdu.institution) {
          education = latestEdu.institution;
        }
      }

      // Extract location from CV (priority) or application
      const location = cvData?.cv_data?.identity?.location || app.candidate.location || "Not specified";

      return {
        id: app.application_id,
        applicationId: app.application_id,
        name,
        career,
        currentRole,
        location,
        experienceYears,
        education,
        score: matchScore !== null ? matchScore : null, // null means calculating, number means calculated (0-100)
        isCalculating: matchScore === null, // Track if score is still being calculated
        skills,
        appliedFor: app.job_title || "Unknown Position",
        appliedDate: formatAppliedDate(app.applied_at),
        appliedAt: app.applied_at,
        cvFileTimestamp: app.cv_file_timestamp, // CV file timestamp stored at application time
        status: app.display_status || app.status,
        originalStatus: app.status,
        lastUploadFile: app.candidate.last_upload_file,
        candidateId: app.candidate.id,
        hasCV: !!cvData,
      };
    });
  }, [applications, cvDataMap]);

  const filteredCandidates = useMemo(() => {
    let filtered = candidates.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.appliedFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = filterStatus === "all" || c.status === filterStatus;
      
      // Employment type filter
      const app = applications.find((a) => a.application_id === c.applicationId);
      const matchesEmploymentType = typeFilter === "all" || !typeFilter ||
        app?.employment_type?.toLowerCase() === typeFilter.toLowerCase();
      
      // Saved candidates filter
      const matchesSaved = !showSavedOnly || savedCandidates.includes(c.candidateId);
      
      return matchesSearch && matchesStatus && matchesEmploymentType && matchesSaved;
    });

    // Sort by match score
    if (sortBy === "match-desc") {
      filtered.sort((a, b) => {
        const scoreA = a.score !== null ? a.score : -1;
        const scoreB = b.score !== null ? b.score : -1;
        return scoreB - scoreA; // High to Low
      });
    } else if (sortBy === "match-asc") {
      filtered.sort((a, b) => {
        const scoreA = a.score !== null ? a.score : 999;
        const scoreB = b.score !== null ? b.score : 999;
        return scoreA - scoreB; // Low to High
      });
    } else if (sortBy === "date") {
      filtered.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [candidates, searchQuery, filterStatus, typeFilter, showSavedOnly, savedCandidates, sortBy, applications]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Candidate Pipeline</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage candidates sorted by AI match score
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by job title or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterStatus || "all"} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter || "all"} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <Briefcase className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Job Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match-desc">High to Low</SelectItem>
                  <SelectItem value="match-asc">Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              id="saved"
              checked={showSavedOnly}
              onCheckedChange={(checked) => setShowSavedOnly(checked as boolean)}
            />
            <Label htmlFor="saved" className="text-sm cursor-pointer flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Show saved candidates only
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredCandidates.length} candidates
      </p>

      {/* Candidates List */}
      <div className="space-y-3">
        {isInitialLoading || isLoadingCVs ? (
          // Show skeleton loaders while data loads
          Array.from({ length: Math.max(5, filteredCandidates.length || 5) }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="animate-fade-in">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Match Score Skeleton */}
                  <div className="flex lg:flex-col items-center justify-center">
                    <Skeleton className="w-16 h-16 rounded-full" />
                  </div>
                  {/* Candidate Info Skeleton */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-64" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                  </div>
                  {/* Actions Skeleton */}
                  <div className="flex lg:flex-col gap-2 lg:justify-center lg:min-w-[140px]">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          filteredCandidates.map((candidate, index) => (
            <Card
              key={candidate.id}
              className="hover-lift animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Match Score - Left Section */}
                <div className="flex lg:flex-col items-center justify-center">
                  {candidate.isCalculating ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 h-16 flex items-center justify-center text-muted-foreground">
                        <span className="text-xs">Calculating...</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Match Score</span>
                    </div>
                  ) : candidate.score !== null ? (
                    <MatchScore score={candidate.score} size="md" showLabel={true} />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-16 h-16 flex items-center justify-center text-muted-foreground">
                        <span className="text-xs">N/A</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Match Score</span>
                    </div>
                  )}
                </div>

                {/* Candidate Info - Center Section */}
                <div className="flex-1 space-y-2">
                  {/* Row 1: Name, Status, Applied Date */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{candidate.name}</h3>
                          <Badge variant="outline" className={getStatusColor(candidate.status)}>
                            {candidate.status}
                          </Badge>
                        </div>
                        {/* Row 2: Career/Headline */}
                        {candidate.career && (
                          <p className="text-sm text-foreground mt-0.5" title={candidate.career}>
                            {cleanText(truncateAtWordBoundary(candidate.career, 60))}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      Applied: {candidate.appliedDate}
                    </p>
                  </div>

                  {/* Row 3: Details with Icons */}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5" title={candidate.location}>
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{cleanText(truncateAtWordBoundary(candidate.location, 35))}</span>
                    </span>
                    <span className="flex items-center gap-1.5" title={candidate.currentRole}>
                      <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{cleanText(truncateAtWordBoundary(candidate.currentRole, 40))}</span>
                    </span>
                    <span className="flex items-center gap-1.5" title={candidate.education}>
                      <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{extractBeforeComma(truncateAtWordBoundary(candidate.education, 50))}</span>
                    </span>
                  </div>

                  {/* Row 4: Skills */}
                  {candidate.skills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {candidate.skills.slice(0, 4).map((skill) => (
                        <SkillTag key={skill} skill={skill} className="text-xs" />
                      ))}
                      {candidate.skills.length > 4 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          +{candidate.skills.length - 4} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Row 5: Applied For */}
                  <p className="text-xs text-muted-foreground">
                    Applied for: <span className="text-foreground font-medium">{candidate.appliedFor}</span>
                  </p>
                </div>

                {/* Actions - Right Section */}
                <div className="flex lg:flex-col gap-2 lg:justify-center lg:min-w-[140px]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      // Find the original application to verify candidate ID and get CV file timestamp
                      const originalApp = applications.find((app) => app.application_id === candidate.applicationId);
                      const verifiedCandidateId = originalApp?.candidate.id || candidate.candidateId;
                      
                      console.log('[View Profile Button] Clicked:', {
                        cardCandidateId: candidate.candidateId,
                        cardCandidateName: candidate.name,
                        verifiedCandidateId,
                        originalAppCandidateName: originalApp?.candidate.full_name,
                        cvFileTimestamp: candidate.cvFileTimestamp,
                        appliedAt: candidate.appliedAt,
                        applicationId: candidate.applicationId,
                        matches: candidate.candidateId === verifiedCandidateId,
                      });
                      
                      // Use verified candidate ID and CV file timestamp (preferred) or applied_at (fallback)
                      handleViewProfile(verifiedCandidateId, candidate.cvFileTimestamp, candidate.appliedAt);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    View Profile
                  </Button>
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-success hover:bg-success/90"
                    onClick={() => handleAccept(candidate.applicationId)}
                  >
                    <UserCheck className="w-4 h-4" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => handleReject(candidate.applicationId)}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          ))
        )}
      </div>

      {filteredCandidates.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No candidates found</h3>
          <p className="text-muted-foreground">
            {searchQuery || filterStatus !== "all"
              ? "Try adjusting your search or filters"
              : "No applications received yet"}
          </p>
        </div>
      )}
    </div>
  );
}
