import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Search,
  Filter,
  Calendar,
  Eye,
  Mail,
  Clock,
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
  { value: "withdrawn", label: "Withdrawn" },
];

export default function ManageApplications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Fetch only accepted/hired candidates (status = "applied" or "hired" or other non-rejected statuses)
  // These are candidates that were accepted in the Candidate Pipeline
  const { data: allApplications = [], isLoading } = useQuery<JobApplication[]>({
    queryKey: ["recruiterApplications"],
    queryFn: () => getAllRecruiterApplications(),
    refetchInterval: 10000, // Auto-refresh every 10 seconds to show updated match scores
  });

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

  // Enhance applications with CV names and match scores
  const applicationsWithCVNames = useMemo(() => {
    return applications.map((app) => {
      const cvData = cvDataMap.get(app.candidate.id);
      const cvName = cvData?.cv_data?.identity?.full_name;
      // Use CV name if available, otherwise fallback to profile name
      const displayName = cvName || app.candidate.full_name || "Unknown";
      
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

  const filteredApplications = applicationsWithCVNames.filter((app) => {
    const matchesSearch =
      app.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || app.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        {/* Header Text */}
        <div>
          <h1 className="text-3xl font-bold">Manage Applications</h1>
          <p className="text-muted-foreground mt-1">
            Review applications and update candidate statuses
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {applications.filter((a) => a.status === "applied").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Applied</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {applications.filter((a) => a.status === "reviewing" || a.status === "shortlisted").length}
                  </p>
                  <p className="text-xs text-muted-foreground">In Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {applications.filter((a) => a.status === "shortlisted").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Shortlisted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Filter className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {applications.filter((a) => a.status === "hired").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Hired</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or vacancy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
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
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Applications ({filteredApplications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Applied For</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredApplications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-muted-foreground">
                      No applications found. Accepted candidates will appear here.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredApplications.map((app) => (
                  <TableRow key={app.application_id}>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
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
                        <MatchScore score={app.matchScore} size="sm" showLabel={false} />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-12 h-12 flex items-center justify-center text-muted-foreground">
                            <span className="text-xs">N/A</span>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatAppliedDate(app.applied_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={app.status}
                        onValueChange={(value) =>
                          handleStatusChange(app.application_id, value)
                        }
                      >
                        <SelectTrigger className="w-[160px]">
                          <Badge variant="outline" className={getStatusColor(app.status)}>
                            {getStatusLabel(app.status)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <Badge variant="outline" className={getStatusColor(option.value)}>
                                {option.label}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Mail className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

        </CardContent>
      </Card>
    </div>
  );
}
