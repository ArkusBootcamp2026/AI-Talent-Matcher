import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { StatsCard } from "@/components/shared/StatsCard";
import { MatchScore } from "@/components/shared/MatchScore";
import { SkillTag } from "@/components/shared/SkillTag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Users,
  Clock,
  Plus,
  ArrowRight,
  Eye,
  Calendar,
  UserCheck,
} from "lucide-react";

const recentCandidates = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Senior React Developer",
    score: 92,
    skills: ["React", "TypeScript", "Node.js"],
    avatar: null,
    applied: "2 hours ago",
  },
  {
    id: 2,
    name: "Michael Johnson",
    role: "Full Stack Engineer",
    score: 87,
    skills: ["Python", "Django", "PostgreSQL"],
    avatar: null,
    applied: "5 hours ago",
  },
  {
    id: 3,
    name: "Emily Davis",
    role: "Frontend Developer",
    score: 85,
    skills: ["Vue.js", "CSS", "JavaScript"],
    avatar: null,
    applied: "1 day ago",
  },
];

const activeVacancies = [
  {
    id: 1,
    title: "Senior Frontend Developer",
    department: "Engineering",
    candidates: 24,
    newToday: 3,
    status: "active",
  },
  {
    id: 2,
    title: "Product Manager",
    department: "Product",
    candidates: 18,
    newToday: 2,
    status: "active",
  },
  {
    id: 3,
    title: "UX Designer",
    department: "Design",
    candidates: 12,
    newToday: 1,
    status: "draft",
  },
];

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const userName = user?.full_name || "there";

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
          value={12}
          subtitle="3 closing this week"
          icon={Briefcase}
          trend={{ value: 8, positive: true }}
        />
        <StatsCard
          title="Total Candidates"
          value={248}
          subtitle="Across all positions"
          icon={Users}
          trend={{ value: 12, positive: true }}
        />
        <StatsCard
          title="Pending Reviews"
          value={34}
          subtitle="Need your attention"
          icon={Clock}
        />
        {/* Hired Candidates Shortcut */}
        <Link to="/recruiter/accepted">
          <Card className="glass-card hover-lift cursor-pointer h-full group">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Hired</p>
                  <p className="text-2xl font-bold">3</p>
                  <p className="text-xs text-muted-foreground">View & manage hires</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserCheck className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-xs text-primary font-medium">
                <span>Manage Start Dates</span>
                <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Candidates */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Top Matched Candidates</CardTitle>
            <Link to="/recruiter/pipeline">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={candidate.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {candidate.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{candidate.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        {candidate.applied}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {candidate.role}
                    </p>
                    <div className="flex gap-1 mt-2">
                      {candidate.skills.slice(0, 3).map((skill) => (
                        <SkillTag key={skill} skill={skill} className="text-xs" />
                      ))}
                    </div>
                  </div>
                  <MatchScore score={candidate.score} size="sm" showLabel={false} />
                  <Link to={`/recruiter/candidates/${candidate.id}`}>
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Vacancies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Active Vacancies</CardTitle>
            <Link to="/recruiter/vacancies">
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                Manage <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeVacancies.map((vacancy) => (
                <Link
                  key={vacancy.id}
                  to={`/recruiter/vacancies/${vacancy.id}`}
                  className="block p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{vacancy.title}</h4>
                    <Badge
                      variant={vacancy.status === "active" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {vacancy.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {vacancy.department}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {vacancy.candidates} candidates
                    </span>
                    {vacancy.newToday > 0 && (
                      <span className="text-primary font-medium">
                        +{vacancy.newToday} today
                      </span>
                    )}
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
            <Link to="/recruiter/vacancies/new">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">New Vacancy</p>
                  <p className="text-xs text-muted-foreground">Create a job posting</p>
                </div>
              </Button>
            </Link>
            <Link to="/recruiter/chatbot">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-secondary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">AI Search</p>
                  <p className="text-xs text-muted-foreground">Query candidates with AI</p>
                </div>
              </Button>
            </Link>
            <Link to="/recruiter/applications">
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Schedule</p>
                  <p className="text-xs text-muted-foreground">Manage interviews</p>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}