import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { updateRecruiterProfile, resetPassword, updateEmail } from "@/services/api";
import {
  Mail,
  Lock,
  Bell,
  Building,
  Globe,
  Save,
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [accountSettings, setAccountSettings] = useState({
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [notifications, setNotifications] = useState({
    newApplicants: true,
    interviewReminders: true,
    statusUpdates: false,
    weeklyDigest: true,
  });

  const [companyInfo, setCompanyInfo] = useState({
    companyName: "",
    website: "https://techcorp.com",
  });

  // Load user data
  useEffect(() => {
    if (user) {
      setAccountSettings((prev) => ({
        ...prev,
        email: user.email || "",
      }));
    }
    if (user?.recruiter_profile) {
      setCompanyInfo({
        companyName: user.recruiter_profile.company_name || "",
        website: "https://techcorp.com",
      });
    }
  }, [user]);

  const handleSaveAccount = async () => {
    if (accountSettings.newPassword && accountSettings.newPassword !== accountSettings.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (accountSettings.newPassword && accountSettings.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      let emailUpdated = false;
      let passwordUpdated = false;

      // Update email if it has changed
      if (accountSettings.email && accountSettings.email !== user?.email) {
        await updateEmail({
          new_email: accountSettings.email,
        });
        emailUpdated = true;
        // Invalidate queries to refresh user data
        queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      }

      // Update password if new password is provided
      if (accountSettings.newPassword && accountSettings.confirmPassword) {
        // Use reset-password endpoint with user's email (use new email if updated, otherwise current)
        const emailToUse = emailUpdated ? accountSettings.email : user?.email;
        if (!emailToUse) {
          throw new Error("User email not found");
        }

        await resetPassword({
          email: emailToUse,
          new_password: accountSettings.newPassword,
          confirm_password: accountSettings.confirmPassword,
        });
        passwordUpdated = true;
      }

      if (emailUpdated || passwordUpdated) {
        toast({
          title: "Account Updated",
          description: "Your account settings have been saved.",
        });
      } else {
        toast({
          title: "No Changes",
          description: "No changes were made to your account.",
        });
        return;
      }

      // Clear password fields
      setAccountSettings((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update account",
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Preferences Saved",
      description: "Your notification preferences have been updated.",
    });
  };

  const handleSaveCompany = async () => {
    setIsSavingCompany(true);
    try {
      await updateRecruiterProfile({
        company_name: companyInfo.companyName,
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast({
        title: "Company Info Updated",
        description: "Your company information has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update company info",
        variant: "destructive",
      });
    } finally {
      setIsSavingCompany(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Account Settings
          </CardTitle>
          <CardDescription>
            Update your email and password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={accountSettings.email}
              onChange={(e) =>
                setAccountSettings({ ...accountSettings, email: e.target.value })
              }
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Change Password
            </Label>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={accountSettings.currentPassword}
                  onChange={(e) =>
                    setAccountSettings({
                      ...accountSettings,
                      currentPassword: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={accountSettings.newPassword}
                    onChange={(e) =>
                      setAccountSettings({
                        ...accountSettings,
                        newPassword: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={accountSettings.confirmPassword}
                    onChange={(e) =>
                      setAccountSettings({
                        ...accountSettings,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveAccount}
              disabled={isSavingPassword}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingPassword ? "Saving..." : "Save Account Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose what notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>New Applicant Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when a new candidate applies to your vacancies
              </p>
            </div>
            <Switch
              checked={notifications.newApplicants}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, newApplicants: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Interview Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Receive reminders before scheduled interviews
              </p>
            </div>
            <Switch
              checked={notifications.interviewReminders}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, interviewReminders: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Status Updates</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when candidate statuses change
              </p>
            </div>
            <Switch
              checked={notifications.statusUpdates}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, statusUpdates: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Digest</Label>
              <p className="text-sm text-muted-foreground">
                Receive a weekly summary of your recruitment activity
              </p>
            </div>
            <Switch
              checked={notifications.weeklyDigest}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, weeklyDigest: checked })
              }
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveNotifications} className="gap-2">
              <Save className="w-4 h-4" />
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Company Information
          </CardTitle>
          <CardDescription>
            Update your company details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={companyInfo.companyName}
              onChange={(e) =>
                setCompanyInfo({ ...companyInfo, companyName: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Website
            </Label>
            <Input
              id="website"
              type="url"
              value={companyInfo.website}
              onChange={(e) =>
                setCompanyInfo({ ...companyInfo, website: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveCompany}
              disabled={isSavingCompany}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingCompany ? "Saving..." : "Save Company Info"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
