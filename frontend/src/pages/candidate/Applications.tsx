import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobDetailsModal } from "@/components/candidate/JobDetailsModal";
import { useToast } from "@/hooks/use-toast";
import {
  Building,
  Calendar,
  Clock,
  MapPin,
  FileText,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { getMyApplications } from "@/services/api";
import type { Application, JobPosition } from "@/types/api";

interface TimelineStep {
  step: string;
  date: string;
  completed: boolean;
  current?: boolean;
  failed?: boolean;
}

interface ApplicationWithProgress extends Application {
  progress: number;
  progressColor: string;
  timeline: TimelineStep[];
  statusMessage: string;
  statusMessageColor: string;
}

export default function Applications() {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedJob, setSelectedJob] = useState<JobPosition | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ["myApplications"],
    queryFn: getMyApplications,
  });

  // Calculate progress and timeline for each application
  const applicationsWithProgress = useMemo<ApplicationWithProgress[]>(() => {
    return applications.map((app) => {
      const status = app.status;
      const appliedDate = parseISO(app.applied_at);
      const updatedDate = app.updated_at ? parseISO(app.updated_at) : appliedDate;
      
      let progress = 25;
      let progressColor = "bg-primary";
      let timeline: TimelineStep[] = [];
      let statusMessage = "";
      let statusMessageColor = "bg-success/10 text-success";

      // Build timeline and calculate progress based on status
      switch (status) {
        case "applied":
          progress = 25;
          progressColor = "bg-primary";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true, current: true },
            { step: "CV Review", date: "Pending", completed: false },
            { step: "Interview", date: "TBD", completed: false },
            { step: "Decision", date: "TBD", completed: false },
          ];
          statusMessage = "Your application has been received and is being reviewed.";
          break;

        case "reviewing":
          progress = 50;
          progressColor = "bg-primary";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true },
            { step: "CV Review", date: format(updatedDate, "MMM d"), completed: true, current: true },
            { step: "Interview", date: "TBD", completed: false },
            { step: "Decision", date: "TBD", completed: false },
          ];
          statusMessage = "Your CV is under review. We'll update you soon.";
          break;

        case "shortlisted":
          progress = 60;
          progressColor = "bg-primary";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true },
            { step: "CV Review", date: format(updatedDate, "MMM d"), completed: true },
            { step: "Shortlisted", date: format(updatedDate, "MMM d"), completed: true, current: true },
            { step: "Decision", date: "TBD", completed: false },
          ];
          statusMessage = "Great news! You've been shortlisted. We'll contact you soon about next steps.";
          break;

        case "interview":
          progress = 75;
          progressColor = "bg-primary";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true },
            { step: "CV Review", date: format(updatedDate, "MMM d"), completed: true },
            { step: "Interview", date: format(updatedDate, "MMM d"), completed: false, current: true },
            { step: "Decision", date: "TBD", completed: false },
          ];
          statusMessage = "Interview scheduled. Good luck!";
          break;

        case "hired":
          progress = 100;
          progressColor = "bg-success";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true },
            { step: "CV Review", date: "Completed", completed: true },
            { step: "Interview", date: "Completed", completed: true },
            { step: "Hired", date: format(updatedDate, "MMM d"), completed: true, current: true },
          ];
          statusMessage = app.start_date
            ? `Congratulations! You've been hired. Start date: ${format(parseISO(app.start_date), "MMMM d, yyyy")}`
            : "Congratulations! You've been hired.";
          statusMessageColor = "bg-success/10 text-success";
          break;

        case "rejected":
          progress = 100;
          progressColor = "bg-destructive";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true },
            { step: "CV Review", date: format(updatedDate, "MMM d"), completed: true },
            { step: "Rejected", date: format(updatedDate, "MMM d"), completed: true, failed: true },
          ];
          statusMessage = "Unfortunately, your application was not selected for this position.";
          statusMessageColor = "bg-destructive/10 text-destructive";
          break;

        case "withdrawn":
          progress = 0;
          progressColor = "bg-muted";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true },
            { step: "Withdrawn", date: format(updatedDate, "MMM d"), completed: true, failed: true },
          ];
          statusMessage = "This application has been withdrawn.";
          statusMessageColor = "bg-muted/10 text-muted-foreground";
          break;

        default:
          progress = 25;
          progressColor = "bg-primary";
          timeline = [
            { step: "Applied", date: format(appliedDate, "MMM d"), completed: true, current: true },
            { step: "CV Review", date: "Pending", completed: false },
            { step: "Interview", date: "TBD", completed: false },
            { step: "Decision", date: "TBD", completed: false },
          ];
          statusMessage = "Your application is being processed.";
      }

      return {
        ...app,
        progress,
        progressColor,
        timeline,
        statusMessage,
        statusMessageColor,
      };
    });
  }, [applications]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "interview":
        return (
          <Badge className="bg-success/10 text-success border-success/30">
            Interview Scheduled
          </Badge>
        );
      case "reviewing":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/30">
            Under Review
          </Badge>
        );
      case "shortlisted":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/30">
            Shortlisted
          </Badge>
        );
      case "applied":
        return (
          <Badge className="bg-info/10 text-info border-info/30">Applied</Badge>
        );
      case "hired":
        return (
          <Badge className="bg-success/10 text-success border-success/30">
            Hired
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-muted text-muted-foreground">Rejected</Badge>
        );
      case "withdrawn":
        return (
          <Badge className="bg-muted text-muted-foreground">Withdrawn</Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatSalary = (salaryMin?: number, salaryMax?: number): string => {
    if (!salaryMin && !salaryMax) return "";
    if (salaryMin && salaryMax) {
      return `$${salaryMin.toLocaleString()} - $${salaryMax.toLocaleString()}`;
    }
    if (salaryMin) {
      return `$${salaryMin.toLocaleString()}+`;
    }
    return `Up to $${salaryMax!.toLocaleString()}`;
  };

  const handleConfirmJob = (application: ApplicationWithProgress) => {
    try {
      // Dispatch a custom event so the top-right bell icon can react visually
      window.dispatchEvent(
        new CustomEvent("candidate-job-confirmed", {
          detail: {
            applicationId: application.id,
            jobPositionId: application.job_position_id,
          },
        })
      );
    } catch (error) {
      console.error("Failed to dispatch job confirmation event:", error);
    }

    toast({
      title: "Job confirmed",
      description: "We've notified the recruiter that you've confirmed this job.",
    });
  };

  const handleViewJob = (application: ApplicationWithProgress) => {
    // Build a JobPosition-like object from the application + job details we already have
    const job: JobPosition = {
      id: application.job_position_id,
      job_title: application.job_title || "Unknown Position",
      job_description: application.job_description,
      job_requirements: application.job_requirements,
      job_skills: application.job_skills,
      location: application.location,
      employment_type: application.employment_type,
      optional_salary: application.optional_salary,
      optional_salary_max: application.optional_salary_max,
      closing_date: application.closing_date,
      sprint_duration: undefined,
      recruiter_profile_id: "", // not needed for the modal
      status: "open", // for display purposes
      created_at: application.job_created_at || application.applied_at,
      company_name: application.company_name,
      application_count: undefined,
    };

    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const filteredApplications = applicationsWithProgress.filter((app) => {
    if (activeTab === "all") return true;
    if (activeTab === "active")
      return ["applied", "reviewing", "shortlisted", "interview"].includes(app.status);
    if (activeTab === "offers") return app.status === "hired";
    if (activeTab === "rejected") return app.status === "rejected";
    return true;
  });

  const stats = {
    total: applications.length,
    active: applications.filter((a) =>
      ["applied", "reviewing", "shortlisted", "interview"].includes(a.status)
    ).length,
    offers: applications.filter((a) => a.status === "hired").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Stats */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Applications</h1>
          <p className="text-muted-foreground mt-1">
            Track the status of your job applications
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 md:w-auto md:min-w-[320px]">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Applications</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-success">{stats.offers}</p>
              <p className="text-sm text-muted-foreground">Hired</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-muted-foreground">{stats.rejected}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
          <TabsTrigger value="offers">Hired ({stats.offers})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Applications List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app, index) => (
            <Card
              key={app.id}
              className="hover-lift animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Main Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{app.job_title || "Unknown Position"}</h3>
                        <div className="flex items-center gap-2 text-muted-foreground mt-1">
                          <Building className="w-4 h-4" />
                          <span>{app.company_name || "Unknown Company"}</span>
                        </div>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {app.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {app.location}
                        </span>
                      )}
                      {(app.optional_salary || app.optional_salary_max) && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-4 h-4" />
                          {formatSalary(app.optional_salary, app.optional_salary_max)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Applied: {format(parseISO(app.applied_at), "MMM d, yyyy")}
                      </span>
                    </div>

                    {/* Status Message Box */}
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${app.statusMessageColor}`}>
                      {app.status === "hired" ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : app.status === "rejected" ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">{app.statusMessage}</span>
                    </div>

                    {/* Progress Timeline */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{app.progress}%</span>
                      </div>
                      <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${app.progressColor}`}
                          style={{ width: `${app.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-3">
                        {app.timeline.map((step, i) => (
                          <div
                            key={i}
                            className={`flex flex-col items-center text-center ${
                              step.failed
                                ? "text-destructive"
                                : step.completed
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                                step.failed
                                  ? "bg-destructive/10"
                                  : step.completed
                                  ? "bg-primary/10"
                                  : "bg-muted"
                              } ${step.current ? "ring-2 ring-primary ring-offset-2" : ""}`}
                            >
                              {step.failed ? (
                                <XCircle className="w-4 h-4" />
                              ) : step.completed ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Clock className="w-3 h-3" />
                              )}
                            </div>
                            <span className="text-xs font-medium">{step.step}</span>
                            <span className="text-[10px]">{step.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex lg:flex-col gap-2 lg:justify-center lg:min-w-[140px]">
                    {app.status === "hired" && (
                      <div className="flex flex-col gap-2 w-full">
                        <Button
                          className="flex-1 lg:flex-none bg-gradient-to-r from-success to-accent hover:opacity-90"
                          onClick={() => handleConfirmJob(app)}
                        >
                          Confirm Job
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 lg:flex-none gap-2"
                          onClick={() => handleViewJob(app)}
                        >
                          <FileText className="w-4 h-4" />
                          View Job
                        </Button>
                      </div>
                    )}
                    {app.status !== "rejected" && app.status !== "hired" && (
                      <>
                        <Button variant="outline" className="flex-1 lg:flex-none gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Message
                        </Button>
                        <Button
                          variant="ghost"
                          className="flex-1 lg:flex-none gap-2"
                          onClick={() => handleViewJob(app)}
                        >
                          <FileText className="w-4 h-4" />
                          View Job
                        </Button>
                      </>
                    )}
                    {app.status === "rejected" && (
                      <Link to="/candidate/jobs">
                        <Button variant="outline" className="w-full gap-2">
                          Find Similar Jobs
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredApplications.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No applications found</h3>
          <p className="text-muted-foreground mb-4">
            Start applying to jobs to track your progress here
          </p>
          <Link to="/candidate/jobs">
            <Button className="gap-2">
              <Briefcase className="w-4 h-4" />
              Browse Jobs
            </Button>
          </Link>
        </div>
      )}

      {/* Job Details Modal */}
      <JobDetailsModal
        job={selectedJob}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
