import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchScore } from "@/components/shared/MatchScore";
import { SkillTag } from "@/components/shared/SkillTag";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Eye,
  Calendar as CalendarIcon,
  MapPin,
  Briefcase,
  Trash2,
  CheckCircle,
  Clock,
  UserCheck,
  GraduationCap,
  Filter,
  ArrowUpDown,
  Heart,
} from "lucide-react";
import { getAllRecruiterApplications, getCandidateCV, updateApplicationStartDate, removeHiredCandidate } from "@/services/api";
import { toast } from "sonner";
import type { JobApplication, CVExtractionResponse } from "@/types/api";

export default function HiredCandidates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("match-desc");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedCandidates, setSavedCandidates] = useState<string[]>([]);
  const [editingCandidateId, setEditingCandidateId] = useState<number | null>(null);

  // Fetch all applications and filter for hired status
  const { data: allApplications = [], isLoading } = useQuery<JobApplication[]>({
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

  // Filter to show only hired candidates
  const hiredApplications = useMemo(() => {
    return allApplications.filter((app) => app.status === "hired");
  }, [allApplications]);

  // Get unique candidate IDs for CV fetching
  const candidateIds = useMemo(() => {
    return hiredApplications
      .map((app) => app.candidate.id)
      .filter(Boolean)
      .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate
  }, [hiredApplications]);

  // Fetch CV data for all candidates
  const cvQueries = useQueries({
    queries: candidateIds.map((candidateId) => {
      const app = hiredApplications.find((a) => a.candidate.id === candidateId);
      return {
        queryKey: ["candidateCV", candidateId, app?.cv_file_timestamp || app?.applied_at || "latest"],
        queryFn: () => getCandidateCV(candidateId, app?.applied_at, app?.cv_file_timestamp),
        enabled: !!candidateId,
        retry: false,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        throwOnError: false,
      };
    }),
  });

  // Track CV loading state - check if any CV queries are still loading
  const isLoadingCVs = useMemo(() => {
    return cvQueries.some((query) => query.isLoading || query.isFetching);
  }, [cvQueries]);

  // Create a map of candidate ID to CV data
  const cvDataMap = useMemo(() => {
    const map = new Map<string, CVExtractionResponse>();
    candidateIds.forEach((candidateId, index) => {
      if (index < cvQueries.length) {
        const query = cvQueries[index];
        if (query?.data) {
          map.set(candidateId, query.data);
        }
      }
    });
    return map;
  }, [candidateIds, cvQueries]);

  // Show initial loading state only when applications are loading
  const isInitialLoading = isLoading && hiredApplications.length === 0;

  // Enhance applications with CV data and match scores
  const candidates = useMemo(() => {
    return hiredApplications.map((app) => {
      const cvData = cvDataMap.get(app.candidate.id);
      const identity = cvData?.cv_data?.identity || {};
      const experience = cvData?.cv_data?.experience || [];
      const education = cvData?.cv_data?.education || [];
      const skillsAnalysis = cvData?.cv_data?.skills_analysis || {};
      const explicitSkills = skillsAnalysis.explicit_skills || [];
      const jobRelatedSkills = skillsAnalysis.job_related_skills || [];
      // Combine skills from different sources
      const allSkills = [...explicitSkills, ...jobRelatedSkills];
      const uniqueSkills = Array.from(new Set(allSkills));

      // Extract name from CV or fallback to profile
      const name = identity.full_name || app.candidate.full_name || "Unknown";
      
      // Extract career/role from CV
      const career = identity.professional_title || experience[0]?.role || app.candidate.role_title || "No role specified";
      
      // Extract location from CV or profile
      const location = identity.location || app.candidate.location || "No location";
      
      // Extract skills (limit to 4 for display)
      const displaySkills = uniqueSkills.slice(0, 4);
      const remainingSkills = uniqueSkills.length - 4;

      // Parse start_date if available
      const startDate = app.start_date ? parseISO(app.start_date) : null;
      
      // Determine status: "confirmed" if start_date exists, otherwise "pending"
      const status = startDate ? "confirmed" : "pending";
      
      // Extract match_score from application (0.0 to 1.0), convert to percentage (0-100)
      // If match_score is not available yet (NULL), it means calculation is in progress
      const matchScore = app.match_score !== undefined && app.match_score !== null 
        ? Math.round(Number(app.match_score) * 100) 
        : null; // null means calculating, number means calculated (0-100)

      return {
        ...app,
        name,
        career,
        location,
        skills: displaySkills,
        remainingSkills: remainingSkills > 0 ? remainingSkills : 0,
        education: education[0] ? `${education[0].degree}${education[0].institution ? `, ${education[0].institution}` : ""}` : "No education listed",
        startDate,
        status,
        matchScore,
        isCalculating: matchScore === null,
      };
    });
  }, [hiredApplications, cvDataMap]);

  const updateStartDateMutation = useMutation({
    mutationFn: ({ applicationId, startDate }: { applicationId: number; startDate: string }) =>
      updateApplicationStartDate(applicationId, startDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiterApplications"] });
      toast.success("Start date updated successfully");
      setEditingCandidateId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update start date");
    },
  });

  const removeCandidateMutation = useMutation({
    mutationFn: (applicationId: number) => removeHiredCandidate(applicationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiterApplications"] });
      toast.success("Candidate removed from hired list");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to remove candidate");
    },
  });

  const getStatusBadge = (status: string, startDate: Date | null) => {
    if (status === "confirmed" && startDate) {
      return (
        <Badge className="bg-success/10 text-success border-success/30">
          <CheckCircle className="w-3 h-3 mr-1" />
          Confirmed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
        <Clock className="w-3 h-3 mr-1" />
        Pending Start Date
      </Badge>
    );
  };

  const handleSetStartDate = (applicationId: number, date: Date | undefined) => {
    if (date) {
      const dateString = format(date, "yyyy-MM-dd");
      updateStartDateMutation.mutate({ applicationId, startDate: dateString });
    }
  };

  const handleRemoveCandidate = (applicationId: number) => {
    if (window.confirm("Are you sure you want to remove this candidate from the hired list?")) {
      removeCandidateMutation.mutate(applicationId);
    }
  };

  const handleViewProfile = (candidateId: string, cvFileTimestamp?: string, appliedAt?: string) => {
    const params = new URLSearchParams();
    if (cvFileTimestamp) {
      params.set('cv_file_timestamp', cvFileTimestamp);
    } else if (appliedAt) {
      params.set('applied_at', appliedAt);
    }
    navigate(`/recruiter/candidates/${candidateId}${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const filteredCandidates = useMemo(() => {
    let filtered = candidates.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.career.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.job_title && c.job_title.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Status filter (for confirmed/pending)
      const matchesStatus = filterStatus === "all" || c.status === filterStatus;
      
      // Employment type filter
      const app = hiredApplications.find((a) => a.application_id === c.application_id);
      const matchesEmploymentType = typeFilter === "all" || !typeFilter ||
        app?.employment_type?.toLowerCase() === typeFilter.toLowerCase();
      
      // Saved candidates filter
      const matchesSaved = !showSavedOnly || savedCandidates.includes(c.candidate.id);
      
      return matchesSearch && matchesStatus && matchesEmploymentType && matchesSaved;
    });

    // Sort by match score
    if (sortBy === "match-desc") {
      filtered.sort((a, b) => {
        const scoreA = a.matchScore !== null ? a.matchScore : -1;
        const scoreB = b.matchScore !== null ? b.matchScore : -1;
        return scoreB - scoreA; // High to Low
      });
    } else if (sortBy === "match-asc") {
      filtered.sort((a, b) => {
        const scoreA = a.matchScore !== null ? a.matchScore : 999;
        const scoreB = b.matchScore !== null ? b.matchScore : 999;
        return scoreA - scoreB; // Low to High
      });
    }

    return filtered;
  }, [candidates, searchQuery, filterStatus, typeFilter, showSavedOnly, savedCandidates, sortBy, hiredApplications]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Hired Candidates</h1>
        <p className="text-muted-foreground mt-1">
          Manage hired candidates and their start dates
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
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
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

      {/* Candidates List */}
      <div className="space-y-3">
        {isInitialLoading || isLoadingCVs ? (
          // Show skeleton loaders while data loads
          Array.from({ length: Math.max(5, filteredCandidates.length || 5) }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="animate-fade-in">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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
              key={candidate.application_id}
              className="hover-lift animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Match Score */}
                  <div className="flex lg:flex-col items-center lg:items-center gap-3 lg:gap-1">
                    {candidate.isCalculating ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-16 h-16 flex items-center justify-center text-muted-foreground">
                          <span className="text-xs">Calculating...</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Match Score</span>
                      </div>
                    ) : candidate.matchScore !== null ? (
                      <MatchScore score={candidate.matchScore} size="md" showLabel={true} />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-16 h-16 flex items-center justify-center text-muted-foreground">
                          <span className="text-xs">N/A</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Match Score</span>
                      </div>
                    )}
                  </div>

                  {/* Candidate Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base">{candidate.name}</h3>
                            {getStatusBadge(candidate.status, candidate.startDate)}
                          </div>
                          <p className="text-muted-foreground text-sm">{candidate.career}</p>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {candidate.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" />
                        {candidate.job_title || "Unknown Position"}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        Hired: {format(parseISO(candidate.applied_at), "MMM d, yyyy")}
                      </span>
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill, idx) => (
                        <SkillTag key={idx} skill={typeof skill === 'string' ? skill : skill.name || 'Unknown'} className="text-xs" />
                      ))}
                      {candidate.remainingSkills > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{candidate.remainingSkills} more
                        </Badge>
                      )}
                    </div>

                    {/* Start Date */}
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-sm font-medium">Start Date:</span>
                      {candidate.startDate ? (
                        <Badge variant="outline" className="bg-success/5">
                          <CalendarIcon className="w-3 h-3 mr-1" />
                          {format(candidate.startDate, "MMMM d, yyyy")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/5 text-warning">
                          Not set
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex lg:flex-col gap-1.5 lg:justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 lg:flex-none gap-2"
                      onClick={() => handleViewProfile(
                        candidate.candidate.id,
                        candidate.cv_file_timestamp,
                        candidate.applied_at
                      )}
                    >
                      <Eye className="w-4 h-4" />
                      View Profile
                    </Button>
                    <Popover
                      open={editingCandidateId === candidate.application_id}
                      onOpenChange={(open) => setEditingCandidateId(open ? candidate.application_id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 lg:flex-none gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {candidate.startDate ? "Change Date" : "Set Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={candidate.startDate || undefined}
                          onSelect={(date) => handleSetStartDate(candidate.application_id, date)}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 lg:flex-none gap-2 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveCandidate(candidate.application_id)}
                      disabled={removeCandidateMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {!isLoading && filteredCandidates.length === 0 && (
        <div className="text-center py-12">
          <UserCheck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No hired candidates</h3>
          <p className="text-muted-foreground">
            Candidates set to "Hired" status in Applications will appear here
          </p>
        </div>
      )}
    </div>
  );
}
