import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Briefcase, User, Mail, Lock, ArrowRight, Building, UserCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Register() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "candidate" ? "candidate" : "recruiter";
  
  const { signUpCandidate, signUpRecruiter, isSigningUp, signUpError } = useAuth();
  const [role, setRole] = useState<"recruiter" | "candidate">(initialRole);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    location: "",
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (role === "recruiter" && !formData.company) {
      toast.error("Company name is required for recruiters");
      return;
    }

    if (role === "recruiter") {
      signUpRecruiter(
        {
          email: formData.email,
          password: formData.password,
          full_name: formData.name,
          company_name: formData.company,
        },
        {
          onError: (error: any) => {
            const message = error?.response?.data?.detail || "Failed to create account";
            toast.error(message);
          },
        }
      );
    } else {
      signUpCandidate(
        {
          email: formData.email,
          password: formData.password,
          full_name: formData.name,
          location: formData.location || undefined,
        },
        {
          onError: (error: any) => {
            const message = error?.response?.data?.detail || "Failed to create account";
            toast.error(message);
          },
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-secondary via-secondary/90 to-accent p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <span className="font-bold text-2xl text-white">AI Talent Matcher</span>
          </Link>
        </div>
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Start Your Journey with AI-Powered Matching
          </h2>
          <p className="text-white/80 text-lg max-w-md">
            Join thousands of recruiters and candidates who have transformed their hiring and job search experience.
          </p>
          <div className="flex gap-8 text-white/90">
            <div>
              <p className="text-3xl font-bold">95%</p>
              <p className="text-sm text-white/70">Match Accuracy</p>
            </div>
            <div>
              <p className="text-3xl font-bold">2.5x</p>
              <p className="text-sm text-white/70">Faster Hiring</p>
            </div>
            <div>
              <p className="text-3xl font-bold">50k+</p>
              <p className="text-sm text-white/70">Active Users</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-white/60 text-sm">
          © 2024 AI Talent Matcher
        </div>
      </div>

      {/* Right side - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">AI Talent Matcher</span>
          </div>

          <Card className="border-0 shadow-elevated">
            <CardHeader className="text-center pb-2 px-4 pt-4">
              <CardTitle className="text-2xl">Create Account</CardTitle>
              <CardDescription>Choose your role and get started for free</CardDescription>
            </CardHeader>
            <CardContent className="pt-2 px-4 pb-4">
              <Tabs value={role} onValueChange={(v) => setRole(v as "recruiter" | "candidate")} className="mb-6">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="recruiter" className="gap-2">
                    <Briefcase className="w-4 h-4" />
                    Recruiter
                  </TabsTrigger>
                  <TabsTrigger value="candidate" className="gap-2">
                    <User className="w-4 h-4" />
                    Candidate
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                {role === "recruiter" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company Name *</Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="company"
                          type="text"
                          placeholder="Acme Inc."
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {role === "candidate" && (
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      type="text"
                      placeholder="City, Country"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSigningUp}
                  className="w-full gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  {isSigningUp ? "Creating account..." : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <p className="mt-4 text-xs text-center text-muted-foreground">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </p>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}