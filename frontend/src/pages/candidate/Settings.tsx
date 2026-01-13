import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile, uploadAvatar, updateCandidateProfile, uploadCV } from "@/services/api";
import {
  User,
  Save,
  MapPin,
  FileText,
  Upload,
  Loader2,
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedCV, setSelectedCV] = useState<File | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = useState({
    full_name: "",
    role_title: "",
    avatar_url: "",
  });

  const [candidateData, setCandidateData] = useState({
    location: "",
  });

  // Load user data
  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || "",
        role_title: user.role_title || "",
        avatar_url: user.avatar_url || "",
      });
      if (user.candidate_profile) {
        setCandidateData({
          location: user.candidate_profile.location || "",
        });
      }
    }
  }, [user]);

  // Debug: Log selectedCV changes
  useEffect(() => {
    console.log("selectedCV state changed:", selectedCV);
    if (selectedCV) {
      console.log("File is ready to upload:", {
        name: selectedCV.name,
        size: selectedCV.size,
        type: selectedCV.type,
      });
    } else {
      console.log("No file selected");
    }
  }, [selectedCV]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      // Upload image first if selected
      // The upload_avatar endpoint already updates the profile with avatar_url
      if (selectedImage) {
        const uploadResult = await uploadAvatar(selectedImage);
        
        // Update local state with the new avatar URL from server response
        const newAvatarUrl = uploadResult.avatar_url || uploadResult.profile?.avatar_url;
        setProfileData((prev) => ({
          ...prev,
          avatar_url: newAvatarUrl || prev.avatar_url,
        }));
        setSelectedImage(null);
        
        // Update the user data in the cache immediately with the response from server
        if (uploadResult.profile) {
          queryClient.setQueryData(["currentUser"], uploadResult.profile);
        }
      }

      // Update profile with other fields (full_name, role_title) if they changed
      // Do NOT include avatar_url here since it's already updated by upload_avatar
      const hasChanges = 
        profileData.full_name !== (user?.full_name || "") ||
        profileData.role_title !== (user?.role_title || "");

      if (hasChanges) {
        const updatePayload: { full_name?: string; role_title?: string } = {};
        
        if (profileData.full_name !== (user?.full_name || "")) {
          updatePayload.full_name = profileData.full_name;
        }
        
        if (profileData.role_title !== (user?.role_title || "")) {
          updatePayload.role_title = profileData.role_title;
        }

        const updateResult = await updateProfile(updatePayload);
        
        // Update cache with the updated profile
        if (updateResult.data) {
          queryClient.setQueryData(["currentUser"], updateResult.data);
        }
      }

      // Invalidate and refetch to ensure we have the latest data from server
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      await queryClient.refetchQueries({ queryKey: ["currentUser"] });

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveCandidate = async () => {
    setIsSavingCandidate(true);
    try {
      await updateCandidateProfile({
        location: candidateData.location,
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast({
        title: "Profile Updated",
        description: "Your candidate profile has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update candidate profile",
        variant: "destructive",
      });
    } finally {
      setIsSavingCandidate(false);
    }
  };

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
  };

  const handleImageRemove = () => {
    setSelectedImage(null);
    setProfileData((prev) => ({ ...prev, avatar_url: "" }));
  };

  const handleCVSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("=== FILE INPUT CHANGED ===");
    console.log("Event:", event);
    console.log("Files:", event.target.files);
    console.log("Files length:", event.target.files?.length);
    
    const file = event.target.files?.[0];
    if (!file) {
      console.warn("No file selected in handleCVSelect");
      setSelectedCV(null);
      return;
    }

    console.log("File selected:", {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });

    // Validate file type
    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    console.log("File validation:", {
      fileType: file.type,
      fileExt,
      allowedTypes,
      allowedExtensions,
      typeMatch: allowedTypes.includes(file.type),
      extMatch: allowedExtensions.includes(fileExt),
    });

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      console.error("File type validation failed");
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF, DOC, or DOCX file.",
        variant: "destructive",
      });
      setSelectedCV(null);
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error("File size validation failed:", file.size, ">", maxSize);
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      setSelectedCV(null);
      return;
    }

    console.log("File validation passed, setting selectedCV");
    setSelectedCV(file);
    console.log("selectedCV state updated, file should now be:", file.name);
  };

  const handleCVUpload = async () => {
    console.log("handleCVUpload called", { selectedCV, isUploadingCV });
    
    if (!selectedCV) {
      console.warn("No CV file selected - button should be disabled");
      toast({
        title: "No File Selected",
        description: "Please select a CV file first.",
        variant: "destructive",
      });
      return;
    }

    console.log("Starting CV upload:", {
      filename: selectedCV.name,
      size: selectedCV.size,
      type: selectedCV.type,
    });

    setIsUploadingCV(true);
    console.log("isUploadingCV set to true");
    
    try {
      console.log("Calling uploadCV function...");
      const result = await uploadCV(selectedCV);
      console.log("CV upload successful:", result);
      
      toast({
        title: "CV Uploaded Successfully",
        description: "Your CV has been processed and stored.",
      });

      setSelectedCV(null);
      if (cvInputRef.current) {
        cvInputRef.current.value = "";
      }

      // Invalidate queries to refresh user data
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    } catch (error: any) {
      console.error("CV upload error:", error);
      console.error("Error details:", {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        stack: error?.stack,
      });
      
      toast({
        title: "Upload Failed",
        description: error?.response?.data?.detail || error?.message || "Failed to upload CV. Please try again.",
        variant: "destructive",
      });
    } finally {
      console.log("Setting isUploadingCV to false");
      setIsUploadingCV(false);
    }
  };

  const handleCVRemove = () => {
    setSelectedCV(null);
    if (cvInputRef.current) {
      cvInputRef.current.value = "";
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

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Update your profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <ImageUpload
              currentImageUrl={profileData.avatar_url}
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              maxSizeMB={5}
            />
          </div>

          <Separator />

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={profileData.full_name}
              onChange={(e) =>
                setProfileData({ ...profileData, full_name: e.target.value })
              }
            />
          </div>

          {/* Role Title */}
          <div className="space-y-2">
            <Label htmlFor="role_title">Role</Label>
            <Input
              id="role_title"
              value={profileData.role_title}
              onChange={(e) =>
                setProfileData({ ...profileData, role_title: e.target.value })
              }
              placeholder="e.g. Software Developer, Frontend Engineer"
            />
            <p className="text-xs text-muted-foreground">
              Enter your job title or position
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Candidate Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Candidate Information
          </CardTitle>
          <CardDescription>
            Update your candidate profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g. San Francisco, CA"
              value={candidateData.location}
              onChange={(e) =>
                setCandidateData({ ...candidateData, location: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveCandidate}
              disabled={isSavingCandidate}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingCandidate ? "Saving..." : "Save Candidate Info"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CV Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            CV Upload
          </CardTitle>
          <CardDescription>
            Upload your CV (PDF, DOC, or DOCX) to extract and store your professional information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cv_upload">CV File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cv_upload"
                ref={cvInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleCVSelect}
                className="flex-1"
              />
            </div>
            {selectedCV ? (
              <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{selectedCV.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(selectedCV.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    console.log("Remove CV button clicked");
                    e.preventDefault();
                    handleCVRemove();
                  }}
                  disabled={isUploadingCV}
                  type="button"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No file selected. Please choose a PDF, DOC, or DOCX file.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, DOC, DOCX. Maximum file size: 10MB.
            </p>
          </div>

          <div className="flex justify-end pt-4 gap-2 items-center">
            {selectedCV && (
              <span className="text-xs text-muted-foreground">
                Ready to upload: {selectedCV.name}
              </span>
            )}
            <Button
              onClick={(e) => {
                console.log("=== UPLOAD CV BUTTON CLICKED ===");
                console.log("Event:", e);
                console.log("selectedCV:", selectedCV);
                console.log("isUploadingCV:", isUploadingCV);
                e.preventDefault();
                e.stopPropagation();
                if (!selectedCV) {
                  console.error("No file selected!");
                  alert("Please select a file first!");
                  return;
                }
                console.log("Calling handleCVUpload...");
                handleCVUpload();
              }}
              disabled={!selectedCV || isUploadingCV}
              className="gap-2"
              type="button"
            >
              {isUploadingCV ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {selectedCV ? "Upload CV" : "Select File First"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
