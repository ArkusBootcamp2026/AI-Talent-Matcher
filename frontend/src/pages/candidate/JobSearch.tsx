import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SkillTag } from "@/components/shared/SkillTag";
import { JobDetailsModal } from "@/components/candidate/JobDetailsModal";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  MapPin,
  Building,
  Clock,
  DollarSign,
  Bookmark,
  BookmarkCheck,
  ArrowUpDown,
  Briefcase,
  Heart,
  CheckCircle2,
} from "lucide-react";
import { getOpenJobs, applyToJob, getMyApplications } from "@/services/api";
import type { JobPosition } from "@/types/api";

export default function JobSearch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("most-recent");
  const [savedJobs, setSavedJobs] = useState<number[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobPosition | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<JobPosition[]>({
    queryKey: ["openJobs"],
    queryFn: getOpenJobs,
  });

  const { data: myApplications = [] } = useQuery({
    queryKey: ["myApplications"],
    queryFn: getMyApplications,
  });

  const appliedJobIds = useMemo(() => {
    return new Set(myApplications.map((app) => app.job_position_id));
  }, [myApplications]);

  const applyMutation = useMutation({
    mutationFn: applyToJob,
    onSuccess: (data, variables) => {
      toast({
        title: "Application submitted!",
        description: "Your application has been successfully submitted.",
        variant: "default",
      });
      setApplyingJobId(null);
      queryClient.invalidateQueries({ queryKey: ["myApplications"] });
      queryClient.invalidateQueries({ queryKey: ["openJobs"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || "Failed to submit application. Please try again.";
      toast({
        title: "Application failed",
        description: errorMessage,
        variant: "destructive",
      });
      setApplyingJobId(null);
    },
  });

  const handleApply = async (jobId: number) => {
    setApplyingJobId(jobId);
    try {
      await applyMutation.mutateAsync({
        job_position_id: jobId,
        // cover_letter is optional, don't send undefined
      });
    } catch (error) {
      // Error handled in onError
    }
  };

  const handleViewDetails = (job: JobPosition) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleApplyFromModal = async (jobId: number) => {
    await handleApply(jobId);
    // Keep modal open so user can see the "Applied" state
  };

  const toggleSaveJob = (jobId: number) => {
    if (savedJobs.includes(jobId)) {
      setSavedJobs(savedJobs.filter((id) => id !== jobId));
    } else {
      setSavedJobs([...savedJobs, jobId]);
    }
  };

  const formatSalary = (salaryMin: number | null | undefined, salaryMax: number | null | undefined): string => {
    if (!salaryMin && !salaryMax) return "";
    if (salaryMin && salaryMax) {
      return `$${salaryMin.toLocaleString()} - $${salaryMax.toLocaleString()}`;
    }
    if (salaryMin) {
      return `$${salaryMin.toLocaleString()}+`;
    }
    return `Up to $${salaryMax!.toLocaleString()}`;
  };

  const parseSkills = (skillsString: string | null | undefined): string[] => {
    if (!skillsString) return [];
    return skillsString.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const formatPostedDate = (dateString: string | undefined): string => {
    if (!dateString) return "";
    try {
      const date = parseISO(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "";
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        const skills = parseSkills(job.job_skills);
        
        // Search filter
        const searchLower = searchQuery.toLowerCase().trim();
        const matchesSearch = !searchLower ||
          job.job_title?.toLowerCase().includes(searchLower) ||
          job.company_name?.toLowerCase().includes(searchLower) ||
          job.job_description?.toLowerCase().includes(searchLower) ||
          skills.some((s) => s.toLowerCase().includes(searchLower));
        
        // Location filter
        const locationLower = locationFilter.toLowerCase().trim();
        const matchesLocation = !locationLower || 
          job.location?.toLowerCase().includes(locationLower);
        
        // Job type filter
        const matchesType = !typeFilter || 
          typeFilter === "all" || 
          job.employment_type?.toLowerCase() === typeFilter.toLowerCase();
        
        // Saved filter
        const matchesSaved = !showSavedOnly || savedJobs.includes(job.id);
        
        return matchesSearch && matchesLocation && matchesType && matchesSaved;
      })
      .sort((a, b) => {
        if (sortBy === "most-recent") {
          const dateA = a.created_at ? parseISO(a.created_at).getTime() : 0;
          const dateB = b.created_at ? parseISO(b.created_at).getTime() : 0;
          return dateB - dateA; // Most recent first
        }
        if (sortBy === "oldest") {
          const dateA = a.created_at ? parseISO(a.created_at).getTime() : 0;
          const dateB = b.created_at ? parseISO(b.created_at).getTime() : 0;
          return dateA - dateB; // Oldest first
        }
        return 0;
      });
  }, [jobs, searchQuery, locationFilter, typeFilter, showSavedOnly, savedJobs, sortBy]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Find Jobs</h1>
        <p className="text-muted-foreground mt-1">
          Discover opportunities matched to your skills and experience
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by job title, company, or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Location"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="pl-10 w-40"
                />
              </div>
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
                  <SelectItem value="most-recent">Most Recent</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
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
              Show saved jobs only
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Found {filteredJobs.length} jobs matching your criteria
        </p>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="animate-fade-in">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Skeleton className="h-6 w-64 mb-2" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-8 rounded" />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <div className="flex lg:flex-col gap-2 lg:min-w-[140px]">
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          filteredJobs.map((job, index) => {
          const skills = parseSkills(job.job_skills);
          const displaySkills = skills.slice(0, 5);
          const remainingSkills = skills.length - displaySkills.length;
          const postedDate = formatPostedDate(job.created_at);
          const salaryDisplay = formatSalary(job.optional_salary, job.optional_salary_max);

          return (
            <Card
              key={job.id}
              className="hover-lift animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Job Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleViewDetails(job)}
                            className="text-lg font-semibold hover:text-primary transition-colors text-left"
                          >
                            {job.job_title}
                          </button>
                          {job.company_name && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Building className="w-3.5 h-3.5" />
                                {job.company_name}
                              </span>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleSaveJob(job.id)}
                            className={`h-7 w-7 flex-shrink-0 ${savedJobs.includes(job.id) ? "text-primary" : ""}`}
                          >
                            {savedJobs.includes(job.id) ? (
                              <BookmarkCheck className="w-4 h-4" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />
                          {job.employment_type}
                        </span>
                      )}
                      {salaryDisplay && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <DollarSign className="w-3.5 h-3.5" />
                          {salaryDisplay}
                        </span>
                      )}
                      {postedDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {postedDate}
                        </span>
                      )}
                    </div>

                    {/* Description - Maximum 2 lines with ellipsis */}
                    {job.job_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {job.job_description}
                      </p>
                    )}

                    {/* Skills */}
                    {displaySkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {displaySkills.map((skill) => (
                          <SkillTag key={skill} skill={skill} className="text-xs" />
                        ))}
                        {remainingSkills > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{remainingSkills} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex lg:flex-col gap-2 lg:justify-center">
                    {appliedJobIds.has(job.id) ? (
                      <Button 
                        disabled 
                        className="w-full bg-success/10 text-success border-success/30 cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Applied
                      </Button>
                    ) : (
                      <Button 
                        className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                        onClick={() => handleApply(job.id)}
                        disabled={applyingJobId === job.id || isLoading}
                      >
                        {applyingJobId === job.id ? "Applying..." : "Apply Now"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full flex-1 lg:flex-none"
                      onClick={() => handleViewDetails(job)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
        )}
      </div>

      {filteredJobs.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No jobs found</h3>
          <p className="text-muted-foreground">
            {searchQuery || locationFilter || typeFilter
              ? "Try adjusting your search or filters"
              : "No open positions available at the moment"}
          </p>
        </div>
      )}

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onApply={handleApplyFromModal}
        isApplying={applyingJobId === selectedJob?.id}
      />
    </div>
  );
}
