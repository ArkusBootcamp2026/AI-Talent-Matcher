import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Search,
  ClipboardList,
  Settings,
  LogOut,
  Brain,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { UserProfileSheet } from "@/components/shared/UserProfileSheet";

const menuItems = [
  { title: "Dashboard", url: "/candidate", icon: LayoutDashboard },
  { title: "My Profile", url: "/candidate/profile", icon: FileText },
  { title: "Job Search", url: "/candidate/jobs", icon: Search },
  { title: "Applications", url: "/candidate/applications", icon: ClipboardList },
  { title: "Skill Coach", url: "/candidate/skill-coach", icon: Brain },
];

export function CandidateSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { completion: profileCompletion } = useProfileCompletion();
  
  const userName = user?.full_name || "User";
  const userRole = user?.role_title || "Candidate";
  const userAvatar = user?.avatar_url && typeof user.avatar_url === 'string' && user.avatar_url.trim() !== "" ? user.avatar_url : undefined;
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Debug logging for avatar URL (only in development)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (userAvatar) {
        console.log("CandidateSidebar - Avatar URL:", userAvatar);
        console.log("CandidateSidebar - Avatar URL type:", typeof userAvatar);
        console.log("CandidateSidebar - Avatar URL length:", userAvatar.length);
      } else {
        console.log("CandidateSidebar - No avatar URL available, user avatar_url:", user?.avatar_url);
      }
    }
  }, [userAvatar, user?.avatar_url]);

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">AI Talent</h1>
            <p className="text-xs text-sidebar-foreground/60">Candidate Portal</p>
          </div>
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider px-3 mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url || 
                  (item.url !== "/candidate" && location.pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <div className="px-3 py-4 mx-2 rounded-xl bg-sidebar-accent/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-sidebar-foreground/70">Profile Completion</span>
              <span className="text-xs font-medium text-sidebar-primary">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-1.5" />
            <p className="text-xs text-sidebar-foreground/50 mt-2">
              Complete your profile to improve match accuracy
            </p>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <UserProfileSheet>
          <div className="flex items-center gap-3 mb-3 cursor-pointer hover:bg-sidebar-accent rounded-lg p-2 transition-colors">
            <Avatar className="w-10 h-10">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {userInitials || <User className="w-5 h-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userName}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {userRole}
              </p>
            </div>
          </div>
        </UserProfileSheet>
        <div className="flex gap-2">
          <NavLink
            to="/candidate/settings"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </NavLink>
          <NavLink
            to="/"
            className="flex items-center justify-center px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </NavLink>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}