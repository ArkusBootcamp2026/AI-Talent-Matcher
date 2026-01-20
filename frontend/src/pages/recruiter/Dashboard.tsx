import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { parseISO, formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { StatsCard } from "@/components/shared/StatsCard";
import { MatchScore } from "@/components/shared/MatchScore";
import { SkillTag } from "@/components/shared/SkillTag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Plus,
  ArrowRight,
  Eye,
  Calendar,
  UserCheck,
  MapPin,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import { getMyJobs, getAllRecruiterApplications, getCandidateCV } from "@/services/api";
import type { JobPosition, JobApplication, CVExtractionResponse } from "@/types/api";

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const userName = user?.full_name || "there";

  // Fetch real data
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery<JobPosition[]>({
    queryKey: ["myJobs"],
    queryFn: getMyJobs,
  });

  const { data: allApplications = [], isLoading: isLoadingApplications } = useQuery<JobApplication[]>({
    queryKey: ["recruiterApplications"],
    queryFn: () => getAllRecruiterApplications(),
  });

  // Calculate stats from real data
  const stats = useMemo(() => {
    const activeVacancies = jobs.filter((job) => job.status === "open");
    
    // Get unique candidates (by candidate.id)
    const uniqueCandidates = new Set(
      allApplications
        .filter((app) => app.status !== "rejected" && app.status !== "withdrawn")
        .map((app) => app.candidate.id)
    );

    // Pending reviews = applications with status "applied" or "reviewing"
    const pendingReviews = allApplications.filter((app) =>
      ["applied", "reviewing"].includes(app.status)
    );

    // Hired candidates
    const hiredCandidates = allApplications.filter((app) => app.status === "hired");

    // Calculate closing this week
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const closingThisWeek = activeVacancies.filter((job) => {
      if (!job.closing_date) return false;
      const closingDate = parseISO(job.closing_date);
      return closingDate >= now && closingDate <= weekFromNow;
    }).length;

    return {
      activeVacancies: activeVacancies.length,
      closingThisWeek,
      totalCandidates: uniqueCandidates.size,
      pendingReviews: pendingReviews.length,
      hired: hiredCandidates.length,
    };
  }, [jobs, allApplications]);

  // Get top matched candidates (sorted by match_score, highest first)
  const topCandidateApplications = useMemo(() => {
    return allApplications
      .filter((app) => app.status !== "rejected" && app.status !== "withdrawn")
      .filter((app: any) => app.match_score != null)
      .sort((a: any, b: any) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, 3);
  }, [allApplications]);

  // Get unique candidate IDs for CV fetching
  const topCandidateIds = useMemo(() => {
    return topCandidateApplications
      .map((app) => app.candidate.id)
      .filter(Boolean)
      .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate
  }, [topCandidateApplications]);

  // Fetch CV data for top candidates
  const cvQueries = useQueries({
    queries: topCandidateIds.map((candidateId) => {
      const app = topCandidateApplications.find((a) => a.candidate.id === candidateId);
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
    topCandidateIds.forEach((candidateId, index) => {
      if (index < cvQueries.length) {
        const query = cvQueries[index];
        if (query?.data) {
          map.set(candidateId, query.data);
        }
      }
    });
    return map;
  }, [topCandidateIds, cvQueries]);

  // Helper function to convert to Title Case
  const toTitleCase = (str: string): string => {
    if (!str) return str;
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Helper function to truncate text at word boundaries
  const truncateAtWordBoundary = (text: string, maxLength: number): string => {
    if (!text || text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      return truncated.substring(0, lastSpace);
    }
    return truncated;
  };

  // Helper function to clean text
  const cleanText = (text: string): string => {
    if (!text) return text;
    return text.replace(/[,.\s]+$/, '').trim();
  };

  // Helper function to extract before comma
  const extractBeforeComma = (text: string): string => {
    if (!text) return text;
    const commaIndex = text.indexOf(',');
    if (commaIndex > 0) {
      return cleanText(text.substring(0, commaIndex));
    }
    return cleanText(text);
  };

  // Transform top candidates with CV data
  const topCandidates = useMemo(() => {
    return topCandidateApplications.map((app) => {
      const cvData = cvDataMap.get(app.candidate.id);
      
      // Extract name from CV (priority) or application
      const rawName = cvData?.cv_data?.identity?.full_name || app.candidate.full_name || "Unknown";
      const name = toTitleCase(rawName);
      
      // Extract career/headline
      let career = "";
      if (cvData?.cv_data?.identity?.headline) {
        career = cvData.cv_data.identity.headline;
      } else if (cvData?.cv_data?.experience && Array.isArray(cvData.cv_data.experience) && cvData.cv_data.experience.length > 0) {
        const latestExp = cvData.cv_data.experience[0];
        career = latestExp.role || "";
      }
      
      // Extract current role
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
      
      // Extract education
      let education = "N/A";
      if (cvData?.cv_data?.education && Array.isArray(cvData.cv_data.education) && cvData.cv_data.education.length > 0) {
        const latestEdu = cvData.cv_data.education[0];
        if (latestEdu.degree && latestEdu.institution) {
          education = `${latestEdu.degree}, ${latestEdu.institution}`;
        } else if (latestEdu.degree) {
          education = latestEdu.degree;
        }
      }
      
      // Extract location
      const location = cvData?.cv_data?.identity?.location || app.candidate.location || "Not specified";
      
      return {
        id: app.candidate.id,
        name,
        career,
        currentRole,
        location,
        education,
        role: app.job_title || "Unknown Position",
        score: Math.round((app.match_score || 0) * 100),
        skills,
        applied: format(parseISO(app.applied_at), "MMM d, yyyy"),
        appliedAt: app.applied_at,
        cvFileTimestamp: app.cv_file_timestamp,
      };
    });
  }, [topCandidateApplications, cvDataMap]);

  // Get active vacancies list
  const activeVacancies = useMemo(() => {
    return jobs
      .filter((job) => job.status === "open")
      .slice(0, 3)
      .map((job) => {
        // Count applications for this job
        const jobApplications = allApplications.filter(
          (app) => app.job_position_id === job.id
        );
        
        // Count new applications today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newToday = jobApplications.filter((app) => {
          const appliedDate = parseISO(app.applied_at);
          appliedDate.setHours(0, 0, 0, 0);
          return appliedDate.getTime() === today.getTime();
        }).length;

        return {
          id: job.id,
          title: job.job_title || "Unknown Position",
          department: job.location || "Not specified",
          candidates: jobApplications.length,
          newToday,
          status: job.status,
        };
      });
  }, [jobs, allApplications]);

  // Show loading state
  if (isLoadingJobs || isLoadingApplications) {
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
            Here's what's happening with your recruitment pipeline
          </p>
        </div>
        <Link to="/recruiter/vacancies/new">
          <Button className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90">
            <Plus className="w-4 h-4" />
            Create Vacancy
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Active Vacancies"
          value={stats.activeVacancies}
          subtitle={stats.closingThisWeek > 0 ? `${stats.closingThisWeek} closing this week` : "All active"}
          icon={Plus}
        >
          <Link to="/recruiter/vacancies/new">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
              <div className="text-left">
                <p className="font-medium">New Vacancy</p>
                <p className="text-xs text-muted-foreground">Create a job posting</p>
              </div>
            </Button>
          </Link>
        </StatsCard>
        <StatsCard
          title="Total Candidates"
          value={stats.totalCandidates}
          subtitle="Across all positions"
          icon={Users}
        >
          <Link to="/recruiter/chatbot">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
              <div className="text-left">
                <p className="font-medium">AI Search</p>
                <p className="text-xs text-muted-foreground">Query candidates with AI</p>
              </div>
            </Button>
          </Link>
        </StatsCard>
        <StatsCard
          title="Pending Reviews"
          value={stats.pendingReviews}
          subtitle="Need your attention"
          icon={Calendar}
        >
          <Link to="/recruiter/applications">
            <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
              <div className="text-left">
                <p className="font-medium">Schedule</p>
                <p className="text-xs text-muted-foreground">Manage interviews</p>
              </div>
            </Button>
          </Link>
        </StatsCard>
        {/* Hired Candidates Shortcut */}
        <Link to="/recruiter/accepted">
          <Card className="h-full bg-gradient-to-br from-success/10 via-primary/5 to-accent/10 border-success/30 hover:border-success/50 transition-all cursor-pointer group">
            <CardContent className="p-4 h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success to-primary flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-primary-foreground" />
                </div>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                  {stats.hired} hired
                </Badge>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Hired Candidates</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {stats.hired > 0 
                    ? `Manage ${stats.hired} hired candidate${stats.hired !== 1 ? 's' : ''} and their start dates`
                    : "No hired candidates yet. Start hiring to manage them here"
                  }
                </p>
              </div>
              <div className="flex items-center text-xs text-primary font-medium group-hover:gap-2 transition-all">
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                Manage Start Dates
                <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Candidates */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-3">
            <CardTitle className="text-lg">Top Matched Candidates</CardTitle>
            <Link to="/recruiter/pipeline">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {topCandidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No candidates with match scores yet.</p>
                  <p className="text-sm mt-2">Candidates will appear here once match scores are calculated.</p>
                </div>
              ) : (
                topCandidates.map((candidate) => {
                  const params = new URLSearchParams();
                  if (candidate.cvFileTimestamp) {
                    params.set('cv_file_timestamp', candidate.cvFileTimestamp);
                  } else if (candidate.appliedAt) {
                    params.set('applied_at', candidate.appliedAt);
                  }
                  const profileUrl = `/recruiter/candidates/${candidate.id}${params.toString() ? `?${params.toString()}` : ''}`;
                  
                  return (
                    <div
                      key={candidate.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      {/* Match Score - Smaller */}
                      <div className="flex-shrink-0">
                        <MatchScore score={candidate.score} size="sm" showLabel={false} />
                      </div>
                      
                      {/* Avatar - Smaller */}
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Candidate Info - Compact */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{candidate.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1" title={candidate.location}>
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{cleanText(truncateAtWordBoundary(candidate.location, 20))}</span>
                              </span>
                              <span className="flex items-center gap-1" title={candidate.currentRole}>
                                <Briefcase className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{cleanText(truncateAtWordBoundary(candidate.currentRole, 25))}</span>
                              </span>
                            </div>
                            {candidate.skills.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {candidate.skills.slice(0, 2).map((skill) => (
                                  <SkillTag key={skill} skill={skill} className="text-xs py-0.5 px-1.5" />
                                ))}
                                {candidate.skills.length > 2 && (
                                  <span className="text-xs text-muted-foreground">+{candidate.skills.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {candidate.applied}
                            </span>
                            <Link to={profileUrl}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Applied for: <span className="text-foreground font-medium">{candidate.role}</span>
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Vacancies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-3">
            <CardTitle className="text-lg">Active Vacancies</CardTitle>
            <Link to="/recruiter/vacancies">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                Manage <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {activeVacancies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No active vacancies yet.</p>
                  <p className="text-sm mt-2">Create your first vacancy to get started.</p>
                </div>
              ) : (
                activeVacancies.map((vacancy) => (
                  <Link
                    key={vacancy.id}
                    to={`/recruiter/vacancies/${vacancy.id}`}
                    className="block p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{vacancy.title}</h4>
                      <Badge
                        variant={vacancy.status === "open" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {vacancy.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {vacancy.department} • {vacancy.candidates} candidates
                      </span>
                      {vacancy.newToday > 0 && (
                        <span className="text-primary font-medium">
                          +{vacancy.newToday} today
                        </span>
                      )}
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