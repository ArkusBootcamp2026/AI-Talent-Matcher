import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { updateCandidateProfile, resetPassword, updateEmail } from "@/services/api";
import {
  Lock,
  Mail,
  MapPin,
  Save,
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const [accountSettings, setAccountSettings] = useState({
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [locationData, setLocationData] = useState({
    location: "",
  });

  // Load user data
  useEffect(() => {
    if (user) {
      setAccountSettings((prev) => ({
        ...prev,
        email: user.email || "",
      }));
    }
    if (user?.candidate_profile) {
      setLocationData({
        location: user.candidate_profile.location || "",
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

  const handleSaveLocation = async () => {
    setIsSavingLocation(true);
    try {
      await updateCandidateProfile({
        location: locationData.location,
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast({
        title: "Location Updated",
        description: "Your location has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update location",
        variant: "destructive",
      });
    } finally {
      setIsSavingLocation(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings
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

      {/* Change Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Location
          </CardTitle>
          <CardDescription>
            Update your location information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g. San Francisco, CA"
              value={locationData.location}
              onChange={(e) =>
                setLocationData({ ...locationData, location: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveLocation}
              disabled={isSavingLocation}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingLocation ? "Saving..." : "Save Location"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
