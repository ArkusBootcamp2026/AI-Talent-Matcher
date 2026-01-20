import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CandidateSidebar } from "./CandidateSidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CandidateLayout() {
  const [hasJobConfirmation, setHasJobConfirmation] = useState(false);

  useEffect(() => {
    const handleJobConfirmed = () => {
      setHasJobConfirmation(true);
    };

    window.addEventListener("candidate-job-confirmed", handleJobConfirmed as EventListener);

    return () => {
      window.removeEventListener("candidate-job-confirmed", handleJobConfirmed as EventListener);
    };
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <CandidateSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="lg:hidden" />
              <div className="relative hidden">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs, companies..."
                  className="pl-10 w-80 bg-muted/50 border-0 focus-visible:ring-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative transition-colors",
                  hasJobConfirmation && "text-primary"
                )}
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span
                  className={cn(
                    "absolute top-1 right-1 w-2 h-2 rounded-full bg-primary",
                    hasJobConfirmation && "animate-pulse"
                  )}
                />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}