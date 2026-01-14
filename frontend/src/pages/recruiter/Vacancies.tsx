import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Users,
  Calendar,
  MapPin,
  Briefcase,
  Edit,
  Eye,
  Trash2,
} from "lucide-react";
import { getMyJobs, deleteJob } from "@/services/api";
import { toast } from "sonner";
import type { JobPosition } from "@/types/api";

export default function Vacancies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery<JobPosition[]>({
    queryKey: ["myJobs"],
    queryFn: getMyJobs,
  });

  const handleDeleteClick = (job: JobPosition) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;

    setIsDeleting(true);
    try {
      await deleteJob(jobToDelete.id);
      toast.success("Vacancy deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["myJobs"] });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to delete vacancy");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
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

  const filteredVacancies = jobs.filter((job) => {
    const matchesSearch =
      job.job_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const statusMap: Record<string, string> = {
      open: "active",
      draft: "draft",
      closed: "closed",
    };
    
    const jobStatus = statusMap[job.status] || job.status;
    const matchesTab = activeTab === "all" || jobStatus === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "open":
        return "bg-success/10 text-success border-success/30";
      case "draft":
        return "bg-warning/10 text-warning border-warning/30";
      case "closed":
        return "bg-muted text-muted-foreground";
      default:
        return "";
    }
  };

  const formatStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      open: "active",
      draft: "draft",
      closed: "closed",
    };
    return statusMap[status] || status;
  };

  const activeJobs = jobs.filter((j) => j.status === "open");
  const draftJobs = jobs.filter((j) => j.status === "draft");
  const closedJobs = jobs.filter((j) => j.status === "closed");

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Vacancies</h1>
          <p className="text-muted-foreground mt-1">
            Manage your job postings and track applications
          </p>
        </div>
        <Link to="/recruiter/vacancies/new">
          <Button className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90">
            <Plus className="w-4 h-4" />
            Create Vacancy
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vacancies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({jobs.length})</TabsTrigger>
            <TabsTrigger value="active">
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="draft">
              Draft ({draftJobs.length})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed ({closedJobs.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Vacancies List */}
      <div className="space-y-4">
        {filteredVacancies.map((job) => {
          const skills = parseSkills(job.job_skills || "");
          // Show minimum 3, maximum 5 skills
          const minSkills = Math.min(3, skills.length);
          const maxSkills = Math.min(5, skills.length);
          const displaySkills = skills.slice(0, maxSkills);
          const remainingSkills = skills.length - maxSkills;
          const jobStatus = formatStatus(job.status);
          const postedDate = job.created_at ? format(parseISO(job.created_at), "MMM d, yyyy") : null;
          const closingDate = job.closing_date ? format(parseISO(job.closing_date), "MMM d, yyyy") : null;

          return (
            <Card key={job.id} className="hover-lift">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  {/* Main Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/recruiter/vacancies/${job.id}`}
                            className="text-lg font-semibold hover:text-primary transition-colors"
                          >
                            {job.job_title}
                          </Link>
                          <Badge variant="outline" className={getStatusColor(jobStatus)}>
                            {jobStatus}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {job.location}
                            </span>
                          )}
                          {job.employment_type && (
                            <span>{job.employment_type}</span>
                          )}
                          {(job.optional_salary || job.optional_salary_max) && (
                            <span className="font-medium text-foreground">
                              {formatSalary(job.optional_salary, job.optional_salary_max)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Skills - Show 3-5 skills */}
                    {displaySkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {displaySkills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {remainingSkills > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{remainingSkills} more
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Dates */}
                    {postedDate && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Posted: {postedDate}
                        </span>
                        {closingDate && (
                          <span>Closes: {closingDate}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats & Actions */}
                  <div className="flex items-center gap-4">
                    <Link
                      to={`/recruiter/pipeline?vacancy=${job.id}`}
                      className="text-center hover:bg-muted/50 rounded-lg p-2 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-xl font-bold">
                        <Users className="w-4 h-4 text-primary" />
                        {job.application_count ?? 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Candidates</p>
                    </Link>

                    <div className="flex flex-col gap-1.5">
                      <Link to={`/recruiter/vacancies/${job.id}/edit`}>
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                      </Link>
                      <Link to={`/recruiter/vacancies/${job.id}`}>
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(job)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredVacancies.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No vacancies found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first vacancy to get started"}
          </p>
          <Link to="/recruiter/vacancies/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Vacancy
            </Button>
          </Link>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the vacancy
              "{jobToDelete?.job_title}" and all related applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
