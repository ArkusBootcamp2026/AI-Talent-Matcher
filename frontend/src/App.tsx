import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

// Recruiter Pages
import { RecruiterLayout } from "./components/layout/RecruiterLayout";
import RecruiterDashboard from "./pages/recruiter/Dashboard";
import Vacancies from "./pages/recruiter/Vacancies";
import VacancyCreate from "./pages/recruiter/VacancyCreate";
import CandidatePipeline from "./pages/recruiter/CandidatePipeline";
import CandidateProfile from "./pages/recruiter/CandidateProfile";
import HiredCandidates from "./pages/recruiter/HiredCandidates";
import ManageApplications from "./pages/recruiter/ManageApplications";
import Settings from "./pages/recruiter/Settings";
import Chatbot from "./pages/recruiter/Chatbot";

// Candidate Pages
import { CandidateLayout } from "./components/layout/CandidateLayout";
import CandidateDashboard from "./pages/candidate/Dashboard";
import CVUpload from "./pages/candidate/CVUpload";
import JobSearch from "./pages/candidate/JobSearch";
import Applications from "./pages/candidate/Applications";
import SkillCoach from "./pages/candidate/SkillCoach";
import CandidateSettings from "./pages/candidate/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Recruiter Routes */}
          <Route
            path="/recruiter"
            element={
              <ProtectedRoute requiredRole="recruiter">
                <RecruiterLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RecruiterDashboard />} />
            <Route path="vacancies" element={<Vacancies />} />
            <Route path="vacancies/new" element={<VacancyCreate />} />
            <Route path="vacancies/:id" element={<VacancyCreate />} />
            <Route path="vacancies/:id/edit" element={<VacancyCreate />} />
            <Route path="pipeline" element={<CandidatePipeline />} />
            <Route path="candidates/:id" element={<CandidateProfile />} />
            <Route path="accepted" element={<HiredCandidates />} />
            <Route path="applications" element={<ManageApplications />} />
            <Route path="chatbot" element={<Chatbot />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Candidate Routes */}
          <Route
            path="/candidate"
            element={
              <ProtectedRoute requiredRole="candidate">
                <CandidateLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CandidateDashboard />} />
            <Route path="profile" element={<CVUpload />} />
            <Route path="jobs" element={<JobSearch />} />
            <Route path="jobs/:id" element={<JobSearch />} />
            <Route path="applications" element={<Applications />} />
            <Route path="skill-coach" element={<SkillCoach />} />
            <Route path="settings" element={<CandidateSettings />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;