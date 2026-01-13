import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { StatsCard } from "@/components/shared/StatsCard";
import { MatchScore } from "@/components/shared/MatchScore";
import { SkillTag } from "@/components/shared/SkillTag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";

const suggestedJobs = [
  {
    id: 1,
    title: "Senior Frontend Developer",
    company: "TechCorp Inc.",
    location: "San Francisco, CA",
    salary: "$140k - $180k",
    type: "Full-time",
    score: 94,
    skills: ["React", "TypeScript", "Node.js"],
    posted: "2 days ago",
  },
  {
    id: 2,
    title: "React Developer",
    company: "StartupXYZ",
    location: "Remote",
    salary: "$120k - $150k",
    type: "Full-time",
    score: 89,
    skills: ["React", "Redux", "GraphQL"],
    posted: "3 days ago",
  },
  {
    id: 3,
    title: "Full Stack Engineer",
    company: "InnovateTech",
    location: "New York, NY",
    salary: "$130k - $160k",
    type: "Full-time",
    score: 85,
    skills: ["React", "Node.js", "PostgreSQL"],
    posted: "5 days ago",
  },
];

const recentApplications = [
  {
    id: 1,
    title: "Frontend Developer",
    company: "DigitalWave",
    status: "under_review",
    appliedDate: "Dec 12, 2024",
  },
  {
    id: 2,
    title: "React Engineer",
    company: "CloudSoft",
    status: "interview_scheduled",
    appliedDate: "Dec 10, 2024",
  },
  {
    id: 3,
    title: "UI Developer",
    company: "DesignHub",
    status: "applied",
    appliedDate: "Dec 8, 2024",
  },
];

// Mock data: Jobs where user has below-threshold match scores
const lowMatchJobs = [
  {
    id: 1,
    title: "Cloud Engineer",
    company: "CloudSoft",
    matchScore: 58,
    missingSkills: ["AWS", "Kubernetes", "Terraform"],
  },
  {
    id: 2,
    title: "Senior Backend Developer",
    company: "DataFlow Inc.",
    matchScore: 65,
    missingSkills: ["GraphQL", "Docker"],
  },
];

// Threshold below which the skill coach shortcut appears
const MATCH_THRESHOLD = 70;

export default function CandidateDashboard() {
  const { user } = useAuth();
  const { completion: profileCompletion } = useProfileCompletion();
  const userName = user?.full_name || "there";
  const missingItems = profileCompletion === 100 
    ? [] 
    : ["Upload CV", "Add portfolio link", "Upload certifications"];
  
  // Check if user has any jobs below threshold
  const hasLowMatchJobs = lowMatchJobs.some(job => job.matchScore < MATCH_THRESHOLD);
  const lowestMatchJob = lowMatchJobs.reduce((lowest, job) => 
    job.matchScore < lowest.matchScore ? job : lowest, lowMatchJobs[0]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "interview_scheduled":
        return <Badge className="bg-success/10 text-success border-success/30">Interview Scheduled</Badge>;
      case "under_review":
        return <Badge className="bg-primary/10 text-primary border-primary/30">Under Review</Badge>;
      case "applied":
        return <Badge className="bg-info/10 text-info border-info/30">Applied</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
          value={12}
          subtitle="This month"
          icon={ClipboardList}
          trend={{ value: 20, positive: true }}
        />
        <StatsCard
          title="Profile Views"
          value={47}
          subtitle="Last 30 days"
          icon={Eye}
          trend={{ value: 15, positive: true }}
        />
        <StatsCard
          title="Jobs Matched"
          value={156}
          subtitle="Based on your skills"
          icon={Briefcase}
        />
        
        {/* Conditional: Skill Coach Shortcut OR Regular Stats */}
        {hasLowMatchJobs ? (
          <Link to="/candidate/skill-coach" className="block">
            <Card className="h-full bg-gradient-to-br from-warning/10 via-primary/5 to-accent/10 border-warning/30 hover:border-warning/50 transition-all cursor-pointer group">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning to-primary flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                    {lowestMatchJob.matchScore}% match
                  </Badge>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Improve Your Match</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Get AI coaching to reach 100% for "{lowestMatchJob.title}"
                  </p>
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
                </div>
                <div className="flex items-center text-xs text-primary font-medium group-hover:gap-2 transition-all">
                  <Target className="w-3.5 h-3.5 mr-1" />
                  Open Skill Coach
                  <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <StatsCard
            title="Avg. Match Score"
            value="82%"
            subtitle="Across recommendations"
            icon={Target}
            trend={{ value: 3, positive: true }}
          />
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recommended Jobs */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
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
          <CardContent>
            <div className="space-y-4">
              {suggestedJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <MatchScore score={job.score} size="sm" showLabel={false} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/candidate/jobs/${job.id}`}
                          className="font-semibold hover:text-primary transition-colors"
                        >
                          {job.title}
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          <Building className="w-3.5 h-3.5" />
                          {job.company}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {job.posted}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                      <span>{job.type}</span>
                      <span className="font-medium text-foreground">{job.salary}</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {job.skills.map((skill) => (
                        <SkillTag key={skill} skill={skill} className="text-xs" />
                      ))}
                    </div>
                  </div>
                  <Link to={`/candidate/jobs/${job.id}`}>
                    <Button size="sm">Apply</Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Applications</CardTitle>
            <Link to="/candidate/applications">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentApplications.map((app) => (
                <Link
                  key={app.id}
                  to={`/candidate/applications`}
                  className="block p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
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
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link to="/candidate/profile">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Update CV</p>
                  <p className="text-xs text-muted-foreground">Keep your profile fresh</p>
                </div>
              </Button>
            </Link>
            <Link to="/candidate/jobs">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-secondary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Browse Jobs</p>
                  <p className="text-xs text-muted-foreground">Discover new opportunities</p>
                </div>
              </Button>
            </Link>
            <Link to="/candidate/applications">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Track Applications</p>
                  <p className="text-xs text-muted-foreground">Monitor your progress</p>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}