import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { StatsCard } from "@/components/shared/StatsCard";
import { SkillTag } from "@/components/shared/SkillTag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  ClipboardList,
  Eye,
  ArrowRight,
  MapPin,
  Building,
  Clock,
  FileText,
  Sparkles,
  GraduationCap,
  Target,
  DollarSign,
} from "lucide-react";
import { getOpenJobs, getMyApplications } from "@/services/api";
import type { JobPosition, Application } from "@/types/api";

// Threshold below which the skill coach shortcut appears
const MATCH_THRESHOLD = 70;

export default function CandidateDashboard() {
  const { user } = useAuth();
  const { completion: profileCompletion } = useProfileCompletion();
  const userName = user?.full_name || "there";
  const missingItems = profileCompletion === 100 
    ? [] 
    : ["Upload CV", "Add portfolio link", "Upload certifications"];

  // Fetch real data
  const { data: applications = [], isLoading: isLoadingApplications } = useQuery<Application[]>({
    queryKey: ["myApplications"],
    queryFn: getMyApplications,
  });

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery<JobPosition[]>({
    queryKey: ["openJobs"],
    queryFn: getOpenJobs,
  });

  // Calculate stats from real data
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const applicationsThisMonth = applications.filter((app) => {
      const appliedDate = parseISO(app.applied_at);
      return appliedDate >= thisMonthStart;
    });

    const activeApplications = applications.filter((app) =>
      ["applied", "reviewing", "shortlisted", "interview"].includes(app.status)
    );

    const hiredApplications = applications.filter((app) => app.status === "hired");
    const rejectedApplications = applications.filter((app) => app.status === "rejected");

    // Calculate average match score from applications that have it
    // Note: match_score might not be in Application type, but may be returned by API
    const applicationsWithScore = applications.filter((app: any) => app.match_score != null);
    const avgMatchScore = applicationsWithScore.length > 0
      ? Math.round(
          (applicationsWithScore.reduce((sum: number, app: any) => sum + (app.match_score || 0), 0) /
            applicationsWithScore.length) *
            100
        )
      : null;

    return {
      total: applications.length,
      thisMonth: applicationsThisMonth.length,
      active: activeApplications.length,
      hired: hiredApplications.length,
      rejected: rejectedApplications.length,
      avgMatchScore,
    };
  }, [applications]);

  // Get recent applications (last 3, sorted by applied_at desc)
  const recentApplications = useMemo(() => {
    return [...applications]
      .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
      .slice(0, 3)
      .map((app) => ({
        id: app.id,
        title: app.job_title || "Unknown Position",
        company: app.company_name || "Unknown Company",
        status: app.status,
        appliedDate: format(parseISO(app.applied_at), "MMM d, yyyy"),
      }));
  }, [applications]);

  // Get recommended jobs (top 3 open jobs, sorted by created_at desc)
  const suggestedJobs = useMemo(() => {
    return jobs
      .filter((job) => job.status === "open")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((job) => {
        const skills = job.job_skills ? job.job_skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const salaryMin = job.optional_salary;
        const salaryMax = job.optional_salary_max;
        let salary = "";
        if (salaryMin && salaryMax) {
          salary = `$${salaryMin.toLocaleString()} - $${salaryMax.toLocaleString()}`;
        } else if (salaryMin) {
          salary = `$${salaryMin.toLocaleString()}+`;
        } else if (salaryMax) {
          salary = `Up to $${salaryMax.toLocaleString()}`;
        }

        return {
          id: job.id,
          title: job.job_title || "Unknown Position",
          company: job.company_name || "Unknown Company",
          location: job.location || "",
          salary,
          type: job.employment_type || "",
          score: 0, // Match score not available for non-applied jobs
          skills: skills.slice(0, 5),
          posted: formatDistanceToNow(parseISO(job.created_at), { addSuffix: true }),
        };
      });
  }, [jobs]);

  // Find low match jobs from applications with match_score < threshold
  const lowMatchJobs = useMemo(() => {
    return applications
      .filter((app: any) => app.match_score != null && app.match_score < MATCH_THRESHOLD / 100)
      .sort((a: any, b: any) => (a.match_score || 0) - (b.match_score || 0))
      .map((app: any) => ({
        id: app.job_position_id,
        title: app.job_title || "Unknown Position",
        company: app.company_name || "Unknown Company",
        matchScore: Math.round((app.match_score || 0) * 100),
        missingSkills: [], // Not available from API
      }));
  }, [applications]);

  // Check if user has any jobs below threshold
  const hasLowMatchJobs = lowMatchJobs.length > 0;
  const lowestMatchJob = lowMatchJobs[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "interview":
        return <Badge className="bg-success/10 text-success border-success/30">Interview</Badge>;
      case "reviewing":
        return <Badge className="bg-primary/10 text-primary border-primary/30">Under Review</Badge>;
      case "shortlisted":
        return <Badge className="bg-primary/10 text-primary border-primary/30">Shortlisted</Badge>;
      case "applied":
        return <Badge className="bg-info/10 text-info border-info/30">Applied</Badge>;
      case "hired":
        return <Badge className="bg-success/10 text-success border-success/30">Hired</Badge>;
      case "rejected":
        return <Badge className="bg-muted text-muted-foreground">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Show loading state
  if (isLoadingApplications || isLoadingJobs) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {userName}</h1>
          <p className="text-muted-foreground mt-1">
            Here's your job search overview and recommendations
          </p>
        </div>
        <Link to="/candidate/jobs">
          <Button className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90">
            <Sparkles className="w-4 h-4" />
            Find Jobs
          </Button>
        </Link>
      </div>

      {/* Profile Completion Alert */}
      {profileCompletion < 100 && (
        <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold">Complete Your Profile</h3>
                  <Badge variant="secondary">{profileCompletion}%</Badge>
                </div>
                <Progress value={profileCompletion} className="h-2 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Complete your profile to improve match accuracy. Missing: {missingItems.join(", ")}
                </p>
              </div>
              <Link to="/candidate/profile">
                <Button variant="outline" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Update Profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Applications Sent"
          value={stats.thisMonth}
          subtitle="This month"
          icon={FileText}
        >
          <Link to="/candidate/profile">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
              <div className="text-left">
                <p className="font-medium">Update CV</p>
                <p className="text-xs text-muted-foreground">Keep your profile fresh</p>
              </div>
            </Button>
          </Link>
        </StatsCard>
        <StatsCard
          title="Active Applications"
          value={stats.active}
          subtitle="In progress"
          icon={ClipboardList}
        >
          <Link to="/candidate/applications">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
              <div className="text-left">
                <p className="font-medium">Track Applications</p>
                <p className="text-xs text-muted-foreground">Monitor your progress</p>
              </div>
            </Button>
          </Link>
        </StatsCard>
        <StatsCard
          title="Total Jobs"
          value={jobs.length}
          subtitle="Open positions"
          icon={Briefcase}
        >
          <Link to="/candidate/jobs">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
              <div className="text-left">
                <p className="font-medium">Browse Jobs</p>
                <p className="text-xs text-muted-foreground">Discover new opportunities</p>
              </div>
            </Button>
          </Link>
        </StatsCard>
        
        {/* Skill Coach Shortcut */}
        <Link to="/candidate/skill-coach" className="block">
          <Card className="h-full bg-gradient-to-br from-warning/10 via-primary/5 to-accent/10 border-warning/30 hover:border-warning/50 transition-all cursor-pointer group">
            <CardContent className="p-4 h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning to-primary flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary-foreground" />
                </div>
                {lowestMatchJob ? (
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                    {lowestMatchJob.matchScore}% match
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                    Skill Coach
                  </Badge>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Improve Your Match</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {lowestMatchJob 
                    ? `Get AI coaching to reach 100% for "${lowestMatchJob.title}"`
                    : "Get AI coaching to improve your match scores"
                  }
                </p>
                {lowestMatchJob && lowestMatchJob.missingSkills && lowestMatchJob.missingSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {lowestMatchJob.missingSkills.slice(0, 2).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        +{skill}
                      </Badge>
                    ))}
                    {lowestMatchJob.missingSkills.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{lowestMatchJob.missingSkills.length - 2} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center text-xs text-primary font-medium group-hover:gap-2 transition-all">
                <Target className="w-3.5 h-3.5 mr-1" />
                Open Skill Coach
                <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recommended Jobs */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Recommended for You
            </CardTitle>
            <Link to="/candidate/jobs">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-3">
              {suggestedJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No open jobs available at the moment.</p>
              ) : (
                suggestedJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/candidate/jobs/${job.id}`}
                            className="text-lg font-semibold hover:text-primary transition-colors"
                          >
                            {job.title}
                          </Link>
                          {job.company && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building className="w-3.5 h-3.5" />
                                {job.company}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {job.posted}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location}
                        </span>
                      )}
                      {job.type && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />
                          {job.type}
                        </span>
                      )}
                      {job.salary && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <DollarSign className="w-3.5 h-3.5" />
                          {job.salary}
                        </span>
                      )}
                    </div>
                    {job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {job.skills.map((skill) => (
                          <SkillTag key={skill} skill={skill} className="text-xs" />
                        ))}
                      </div>
                    )}
                  </div>
                  <Link to={`/candidate/jobs/${job.id}`} className="flex-shrink-0">
                    <Button size="sm">Apply</Button>
                  </Link>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-3">
            <CardTitle className="text-lg">Recent Applications</CardTitle>
            <Link to="/candidate/applications">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {recentApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No applications yet. Start applying to jobs!</p>
              ) : (
                recentApplications.map((app) => (
                <Link
                  key={app.id}
                  to={`/candidate/applications`}
                  className="block p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-sm">{app.title}</h4>
                      <p className="text-xs text-muted-foreground">{app.company}</p>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Applied: {app.appliedDate}
                  </div>
                </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}