import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MatchScore } from "@/components/shared/MatchScore";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Filter,
  Calendar,
  Eye,
  Mail,
  Clock,
  Briefcase,
  ArrowUpDown,
  Heart,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { getAllRecruiterApplications, updateApplicationStatus, getCandidateCV } from "@/services/api";
import { toast } from "sonner";
import type { JobApplication, CVExtractionResponse } from "@/types/api";

type ApplicationStatus = "applied" | "reviewing" | "shortlisted" | "rejected" | "hired" | "withdrawn";

const statusOptions: { value: ApplicationStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "reviewing", label: "Under Review" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
];

export default function ManageApplications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("match-desc");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedCandidates, setSavedCandidates] = useState<string[]>([]);

  // Fetch only accepted/hired candidates (status = "applied" or "hired" or other non-rejected statuses)
  // These are candidates that were accepted in the Candidate Pipeline
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

  // Filter to show only accepted candidates (exclude rejected and withdrawn)
  const applications = allApplications.filter(
    (app) => app.status !== "rejected" && app.status !== "withdrawn"
  );

  // Get unique candidate IDs for CV fetching
  const candidateIds = useMemo(() => {
    return applications
      .map((app) => app.candidate.id)
      .filter(Boolean)
      .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate
  }, [applications]);

  // Fetch CV data for all candidates
  const cvQueries = useQueries({
    queries: candidateIds.map((candidateId) => {
      // Find the application to get cv_file_timestamp
      const app = applications.find((a) => a.candidate.id === candidateId);
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

  const updateStatusMutation = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: number; status: string }) =>
      updateApplicationStatus(applicationId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiterApplications"] });
      toast.success("Application status updated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update status");
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "applied":
        return "bg-info/10 text-info border-info/30";
      case "reviewing":
        return "bg-warning/10 text-warning border-warning/30";
      case "shortlisted":
        return "bg-primary/10 text-primary border-primary/30";
      case "rejected":
        return "bg-muted text-muted-foreground";
      case "hired":
        return "bg-success/10 text-success border-success/30";
      case "withdrawn":
        return "bg-muted/50 text-muted-foreground border-muted/30";
      default:
        return "";
    }
  };

  const getStatusLabel = (status: string): string => {
    const option = statusOptions.find((opt) => opt.value === status);
    return option?.label || status;
  };

  const handleStatusChange = (applicationId: number, newStatus: string) => {
    updateStatusMutation.mutate({
      applicationId,
      status: newStatus,
    });
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

  // Enhance applications with CV names and match scores
  const applicationsWithCVNames = useMemo(() => {
    return applications.map((app) => {
      const cvData = cvDataMap.get(app.candidate.id);
      const cvName = cvData?.cv_data?.identity?.full_name;
      // Use CV name if available, otherwise fallback to profile name
      const rawName = cvName || app.candidate.full_name || "Unknown";
      // Convert to Title Case (Camel Case) to avoid all uppercase
      const displayName = toTitleCase(rawName);
      
      // Extract match_score from application (0.0 to 1.0), convert to percentage (0-100)
      // If match_score is not available yet (NULL), it means calculation is in progress
      const matchScore = app.match_score !== undefined && app.match_score !== null 
        ? Math.round(Number(app.match_score) * 100) 
        : null; // null means calculating, number means calculated (0-100)
      
      return {
        ...app,
        displayName,
        cvName,
        matchScore,
        isCalculating: matchScore === null,
      };
    });
  }, [applications, cvDataMap]);

  const filteredApplications = useMemo(() => {
    let filtered = applicationsWithCVNames.filter((app) => {
      const matchesSearch =
        app.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || app.status === filterStatus;
      
      // Employment type filter
      const matchesEmploymentType = typeFilter === "all" || !typeFilter ||
        app.employment_type?.toLowerCase() === typeFilter.toLowerCase();
      
      // Saved candidates filter
      const matchesSaved = !showSavedOnly || savedCandidates.includes(app.candidate.id);
      
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
  }, [applicationsWithCVNames, searchQuery, filterStatus, typeFilter, showSavedOnly, savedCandidates, sortBy]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Manage Applications</h1>
        <p className="text-muted-foreground mt-1">
          Review applications and update candidate statuses
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
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Applications ({filteredApplications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Candidate</TableHead>
                <TableHead className="text-center">Applied For</TableHead>
                <TableHead className="text-center">Match</TableHead>
                <TableHead className="text-center">Date</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-10 h-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-12 w-12 mx-auto rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-32 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ) : filteredApplications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-muted-foreground">
                      No applications found. Accepted candidates will appear here.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredApplications.map((app) => {
                  const cvData = cvDataMap.get(app.candidate.id);
                  const isCVLoading = candidateIds.includes(app.candidate.id) && 
                    cvQueries[candidateIds.indexOf(app.candidate.id)]?.isLoading;
                  
                  return (
                    <TableRow key={app.application_id}>
                      <TableCell>
                        {isCVLoading ? (
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {app.displayName?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{app.displayName}</p>
                              <p className="text-xs text-muted-foreground">{app.candidate.location || "No location"}</p>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    <TableCell className="text-center">
                      <p className="font-medium">{app.job_title || "Unknown Position"}</p>
                    </TableCell>
                    <TableCell>
                      {app.isCalculating ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-12 h-12 flex items-center justify-center text-muted-foreground">
                            <span className="text-xs">Calculating...</span>
                          </div>
                        </div>
                      ) : app.matchScore !== null ? (
                        <MatchScore score={app.matchScore} size="md" showLabel={false} />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-12 h-12 flex items-center justify-center text-muted-foreground">
                            <span className="text-xs">N/A</span>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatAppliedDate(app.applied_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <Select
                          value={app.status}
                          onValueChange={(value) =>
                            handleStatusChange(app.application_id, value)
                          }
                        >
                          <SelectTrigger className="w-[160px] bg-white border-muted-foreground/20 hover:bg-muted/50">
                            <Badge variant="outline" className={getStatusColor(app.status)}>
                              {getStatusLabel(app.status)}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent className="bg-white border-muted-foreground/20">
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="hover:bg-muted/50">
                                <Badge variant="outline" className={getStatusColor(option.value)}>
                                  {option.label}
                                </Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewProfile(
                            app.candidate.id,
                            app.cv_file_timestamp,
                            app.applied_at
                          )}
                        >
                          <Eye className="w-8 h-8" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleSaveCandidate(app.candidate.id)}
                          aria-label={savedCandidates.includes(app.candidate.id) ? "Remove bookmark" : "Bookmark candidate"}
                        >
                          {savedCandidates.includes(app.candidate.id) ? (
                            <BookmarkCheck className="w-8 h-8 text-primary fill-primary" />
                          ) : (
                            <Bookmark className="w-8 h-8" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

        </CardContent>
      </Card>
    </div>
  );
}
