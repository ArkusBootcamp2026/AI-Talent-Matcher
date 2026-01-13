import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SkillTag } from "@/components/shared/SkillTag";
import { AILoadingIndicator } from "@/components/shared/AILoadingIndicator";
import { useToast } from "@/hooks/use-toast";
import { uploadCV, updateCV, getLatestCV } from "@/services/api";
import type { CVExtractionResponse } from "@/types/api";
import {
  Upload,
  FileText,
  Check,
  Plus,
  X,
  Sparkles,
  User,
  Briefcase,
  GraduationCap,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

export default function CVUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "analyzing" | "complete">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [detectedSkills, setDetectedSkills] = useState<Array<{ name: string; confidence: number }>>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [originalCVData, setOriginalCVData] = useState<CVExtractionResponse | null>(null);
  const [isLoadingCV, setIsLoadingCV] = useState(true);
  const wasResetRef = useRef(false); // Track if user intentionally reset the CV view
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    title: "",
    summary: "",
    linkedin: "",
    github: "",
    portfolio: "",
  });

  // Load latest CV data on mount and when page becomes visible
  useEffect(() => {
    const loadLatestCV = async () => {
      try {
        setIsLoadingCV(true);
        const result = await getLatestCV();
        
        // Map extracted skills (deduplicate)
        const explicitSkills = result.cv_data.skills_analysis?.explicit_skills || [];
        const jobRelatedSkills = result.cv_data.skills_analysis?.job_related_skills || [];
        const allSkillsSet = new Set([...explicitSkills, ...jobRelatedSkills]);
        const skills = Array.from(allSkillsSet);
        
        const skillsWithConfidence = skills.map((skill, index) => ({
          name: skill,
          confidence: 90 - (index * 2),
        }));
        
        setDetectedSkills(skillsWithConfidence);
        
        // Use explicit_skills as selected skills (these are the saved ones)
        const savedSkills = result.cv_data.skills_analysis?.explicit_skills || [];
        setSelectedSkills(savedSkills);
        
        // Map extracted profile data
        const identity = result.cv_data.identity || {};
        setProfileData({
          name: identity.full_name || "",
          email: identity.email || "",
          phone: identity.phone || "",
          location: identity.location || "",
          title: identity.headline || "",
          summary: identity.introduction || "",
          linkedin: "",
          github: "",
          portfolio: "",
        });
        
        // Store original CV data
        setOriginalCVData(result);
        setUploadState("complete");
        wasResetRef.current = false; // CV loaded successfully, reset the flag
      } catch (error: any) {
        // If no CV found, that's okay - user hasn't uploaded one yet
        if (error?.response?.status !== 404) {
          console.error("Error loading CV:", error);
        }
        // Only set to idle if we're not already in a different state
        // This prevents overwriting the state if user clicked "Replace CV"
        if (uploadState === "idle" || !originalCVData) {
          setUploadState("idle");
        }
      } finally {
        setIsLoadingCV(false);
      }
    };
    
    loadLatestCV();
    
    // Reload when page becomes visible (user navigates back to this page)
    // This ensures that if user clicked "Replace CV" but didn't upload,
    // when they navigate back, the last CV is restored
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reload if user had reset the view (clicked Replace CV) but didn't upload
        // This restores the last uploaded CV
        // The ref flag tracks if user intentionally reset the view
        if (wasResetRef.current) {
          loadLatestCV();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const resetCVState = () => {
    setUploadState("idle");
    setUploadProgress(0);
    setDetectedSkills([]);
    setSelectedSkills([]);
    setNewSkill("");
    setOriginalCVData(null);
    wasResetRef.current = true; // Mark that user intentionally reset the view
    setProfileData({
      name: "",
      email: "",
      phone: "",
      location: "",
      title: "",
      summary: "",
      linkedin: "",
      github: "",
      portfolio: "",
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset state when replacing CV
    resetCVState();

    // Validate file type
    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF, DOC, or DOCX file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }

    // For now, only support PDF
    if (fileExt !== ".pdf") {
      toast({
        title: "File Type Not Supported",
        description: "Currently only PDF files are supported. DOC/DOCX support coming soon.",
        variant: "destructive",
      });
      return;
    }

    setUploadState("uploading");
    setUploadProgress(20);

    try {
      console.log("Starting CV upload from CVUpload page:", file.name);
      
      // Call the real API
      setUploadProgress(40);
      setUploadState("analyzing");
      
      const result = await uploadCV(file);
      console.log("CV extraction result:", result);
      
      setUploadProgress(100);

      // Extract data from API response
      const cvData = result.cv_data;
      
      // Map extracted skills (deduplicate)
      const explicitSkills = cvData.skills_analysis?.explicit_skills || [];
      const jobRelatedSkills = cvData.skills_analysis?.job_related_skills || [];
      const allSkillsSet = new Set([...explicitSkills, ...jobRelatedSkills]);
      const skills = Array.from(allSkillsSet);
      
      const skillsWithConfidence = skills.map((skill, index) => ({
        name: skill,
        confidence: 90 - (index * 2), // Simple confidence scoring
      }));
      
      setDetectedSkills(skillsWithConfidence);
      // Start with all detected skills selected
      setSelectedSkills(skills);

      // Map extracted profile data
      const identity = cvData.identity || {};
      setProfileData({
        name: identity.full_name || "",
        email: identity.email || "",
        phone: identity.phone || "",
        location: identity.location || "",
        title: identity.headline || "",
        summary: identity.introduction || "",
        linkedin: "",
        github: "",
        portfolio: "",
      });

      // Store original CV data for comparison
      setOriginalCVData(result);
      wasResetRef.current = false; // New CV uploaded, clear reset flag

      setUploadState("complete");
      
      toast({
        title: "CV Uploaded Successfully",
        description: `Extracted ${skills.length} skills and profile information.`,
      });

      // Invalidate queries to refresh user data
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      await queryClient.invalidateQueries({ queryKey: ["cv", "latest"] });
      
      // Reload latest CV data to ensure we have the most up-to-date version
      // This ensures that if there were any server-side updates, we get them
      try {
        const latestResult = await getLatestCV();
        // Update state with the latest data from server
        const latestExplicitSkills = latestResult.cv_data.skills_analysis?.explicit_skills || [];
        const latestJobRelatedSkills = latestResult.cv_data.skills_analysis?.job_related_skills || [];
        const latestAllSkillsSet = new Set([...latestExplicitSkills, ...latestJobRelatedSkills]);
        const latestSkills = Array.from(latestAllSkillsSet);
        
        const latestSkillsWithConfidence = latestSkills.map((skill, index) => ({
          name: skill,
          confidence: 90 - (index * 2),
        }));
        
        setDetectedSkills(latestSkillsWithConfidence);
        setSelectedSkills(latestSkills);
        
        const latestIdentity = latestResult.cv_data.identity || {};
        setProfileData({
          name: latestIdentity.full_name || "",
          email: latestIdentity.email || "",
          phone: latestIdentity.phone || "",
          location: latestIdentity.location || "",
          title: latestIdentity.headline || "",
          summary: latestIdentity.introduction || "",
          linkedin: "",
          github: "",
          portfolio: "",
        });
        
        setOriginalCVData(latestResult);
      } catch (error) {
        // If refresh fails, keep the data we already have from the upload response
        console.warn("Failed to refresh latest CV data, using upload response data:", error);
      }
      
    } catch (error: any) {
      console.error("CV upload error:", error);
      
      toast({
        title: "Upload Failed",
        description: error?.response?.data?.detail || error?.message || "Failed to upload CV. Please try again.",
        variant: "destructive",
      });
      
      setUploadState("idle");
      setUploadProgress(0);
    }
  };

  const addSkill = (skill: string) => {
    if (skill && !selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter(s => s !== skill));
  };

  const handleSave = async () => {
    if (!originalCVData) {
      toast({
        title: "No CV Data",
        description: "Please upload a CV first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Compare with original data to find changes
      const originalIdentity = originalCVData.cv_data.identity || {};
      const updates: Record<string, string | string[]> = {};

      if (profileData.name !== (originalIdentity.full_name || "")) {
        updates.full_name = profileData.name;
      }
      if (profileData.title !== (originalIdentity.headline || "")) {
        updates.headline = profileData.title;
      }
      if (profileData.summary !== (originalIdentity.introduction || "")) {
        updates.introduction = profileData.summary;
      }
      if (profileData.email !== (originalIdentity.email || "")) {
        updates.email = profileData.email;
      }
      if (profileData.phone !== (originalIdentity.phone || "")) {
        updates.phone = profileData.phone;
      }
      if (profileData.location !== (originalIdentity.location || "")) {
        updates.location = profileData.location;
      }

      // Compare skills - check if selected skills differ from saved explicit_skills
      const savedSkills = originalCVData.cv_data.skills_analysis?.explicit_skills || [];
      const currentSkills = selectedSkills;
      
      // Check if skills have changed (order-independent comparison)
      const savedSkillsSet = new Set(savedSkills);
      const currentSkillsSet = new Set(currentSkills);
      const skillsChanged = 
        savedSkills.length !== currentSkills.length ||
        !currentSkills.every(skill => savedSkillsSet.has(skill)) ||
        !savedSkills.every(skill => currentSkillsSet.has(skill));
      
      if (skillsChanged) {
        updates.selected_skills = currentSkills;
      }

      // Only update if there are changes
      if (Object.keys(updates).length === 0) {
        toast({
          title: "No Changes",
          description: "No changes detected to save.",
        });
        return;
      }

      console.log("Updating CV with changes:", updates);
      
      const result = await updateCV(updates);
      
      // Invalidate queries to refresh profile completion
      await queryClient.invalidateQueries({ queryKey: ["cv", "latest"] });
      
      // Refresh CV data from server to ensure we have the latest version
      // This is critical to ensure all saved changes are reflected
      try {
        const latestResult = await getLatestCV();
        
        // Map extracted skills (deduplicate)
        const explicitSkills = latestResult.cv_data.skills_analysis?.explicit_skills || [];
        const jobRelatedSkills = latestResult.cv_data.skills_analysis?.job_related_skills || [];
        const allSkillsSet = new Set([...explicitSkills, ...jobRelatedSkills]);
        const skills = Array.from(allSkillsSet);
        
        const skillsWithConfidence = skills.map((skill, index) => ({
          name: skill,
          confidence: 90 - (index * 2),
        }));
        
        setDetectedSkills(skillsWithConfidence);
        
        // Use explicit_skills as selected skills (these are the saved ones)
        const savedSkills = latestResult.cv_data.skills_analysis?.explicit_skills || [];
        setSelectedSkills(savedSkills);
        
        // Map extracted profile data from the refreshed CV
        const identity = latestResult.cv_data.identity || {};
        setProfileData({
          name: identity.full_name || "",
          email: identity.email || "",
          phone: identity.phone || "",
          location: identity.location || "",
          title: identity.headline || "",
          summary: identity.introduction || "",
          linkedin: "",
          github: "",
          portfolio: "",
        });
        
        // Store the refreshed CV data as the new original
        setOriginalCVData(latestResult);
      } catch (refreshError) {
        console.error("Failed to refresh CV data after save:", refreshError);
        // Fallback: update local state if refresh fails
        if (originalCVData) {
          const updatedCVData = { ...originalCVData };
          if (!updatedCVData.cv_data.identity) {
            updatedCVData.cv_data.identity = {};
          }
          Object.assign(updatedCVData.cv_data.identity, updates);
          
          // Update skills if they were changed
          if (updates.selected_skills) {
            if (!updatedCVData.cv_data.skills_analysis) {
              updatedCVData.cv_data.skills_analysis = {};
            }
            updatedCVData.cv_data.skills_analysis.explicit_skills = updates.selected_skills;
          }
          
          setOriginalCVData(updatedCVData);
          
          // Update selected skills state to match saved skills
          if (updates.selected_skills) {
            setSelectedSkills(updates.selected_skills);
          }
        }
      }

      toast({
        title: "Profile Saved",
        description: "Your CV data has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save Failed",
        description: error?.response?.data?.detail || error?.message || "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          Upload your CV and let AI detect your skills automatically
        </p>
      </div>

      {/* CV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            CV / Resume
          </CardTitle>
          <CardDescription>
            Upload your CV and we'll automatically extract your information and skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCV && (
            <div className="py-8 text-center">
              <AILoadingIndicator text="Loading your CV data..." className="justify-center" />
            </div>
          )}
          
          {!isLoadingCV && uploadState === "idle" && (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX (MAX. 10MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
              />
            </label>
          )}

          {!isLoadingCV && uploadState === "uploading" && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center gap-3">
                <Upload className="w-6 h-6 text-primary animate-pulse" />
                <span className="text-sm font-medium">Uploading your CV...</span>
              </div>
              <Progress value={uploadProgress} className="h-2 max-w-md mx-auto" />
              <p className="text-xs text-center text-muted-foreground">{uploadProgress}%</p>
            </div>
          )}

          {!isLoadingCV && uploadState === "analyzing" && (
            <div className="py-8 text-center">
              <AILoadingIndicator text="AI is analyzing your CV and extracting skills..." className="justify-center" />
              <p className="text-sm text-muted-foreground mt-4">
                This usually takes a few seconds...
              </p>
            </div>
          )}

          {!isLoadingCV && uploadState === "complete" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-success">CV uploaded successfully!</p>
                <p className="text-sm text-muted-foreground">
                  We've extracted your information and detected {detectedSkills.length} skills
                </p>
              </div>
              <label className="cursor-pointer">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Reset the view to idle state
                    resetCVState();
                    // Reset input value to allow re-selecting the same file
                    const input = e.currentTarget.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
                    if (input) {
                      input.value = '';
                    }
                  }}
                >
                  Replace CV
                </Button>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills Section */}
      {!isLoadingCV && uploadState === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Detected Skills
            </CardTitle>
            <CardDescription>
              Review AI-detected skills and add any that are missing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Skills */}
            <div className="flex flex-wrap gap-2">
              {selectedSkills.map((skill) => {
                const detected = detectedSkills.find(s => s.name === skill);
                return (
                  <SkillTag
                    key={skill}
                    skill={skill}
                    confidence={detected?.confidence}
                    removable
                    onRemove={() => removeSkill(skill)}
                  />
                );
              })}
            </div>

            {/* Add Skill */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a skill..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill(newSkill);
                  }
                }}
              />
              <Button variant="outline" onClick={() => addSkill(newSkill)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Suggested from CV */}
            {detectedSkills.filter(s => !selectedSkills.includes(s.name)).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Also detected in your CV:</Label>
                <div className="flex flex-wrap gap-2">
                  {detectedSkills
                    .filter(s => !selectedSkills.includes(s.name))
                    .map((skill) => (
                      <Badge
                        key={skill.name}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => addSkill(skill.name)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {skill.name} ({skill.confidence}%)
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profile Information */}
      {uploadState === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Review and edit your extracted profile information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Professional Title</Label>
                <Input
                  id="title"
                  value={profileData.title}
                  onChange={(e) => setProfileData({ ...profileData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Phone
                </Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </Label>
                <Input
                  id="location"
                  value={profileData.location}
                  onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Professional Summary</Label>
              <Textarea
                id="summary"
                value={profileData.summary}
                onChange={(e) => setProfileData({ ...profileData, summary: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {!isLoadingCV && uploadState === "complete" && (
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              // Reset to original values
              if (originalCVData) {
                const identity = originalCVData.cv_data.identity || {};
                setProfileData({
                  name: identity.full_name || "",
                  email: identity.email || "",
                  phone: identity.phone || "",
                  location: identity.location || "",
                  title: identity.headline || "",
                  summary: identity.introduction || "",
                  linkedin: "",
                  github: "",
                  portfolio: "",
                });
                
                // Reset skills to saved ones
                const savedSkills = originalCVData.cv_data.skills_analysis?.explicit_skills || [];
                setSelectedSkills(savedSkills);
              }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
          >
            Save Profile
          </Button>
        </div>
      )}
    </div>
  );
}