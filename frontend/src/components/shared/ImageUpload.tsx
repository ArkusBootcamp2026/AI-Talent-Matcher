import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageSelect: (file: File) => void;
  onImageRemove?: () => void;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({
  currentImageUrl,
  onImageSelect,
  onImageRemove,
  maxSizeMB = 5,
  className,
  disabled = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when currentImageUrl changes (after upload completes)
  // Only update if we don't have a local file preview (data URL)
  useEffect(() => {
    if (currentImageUrl && typeof currentImageUrl === 'string' && currentImageUrl.trim() !== '') {
      // If preview is a data URL (from file selection), keep it until upload completes
      // Otherwise, use the currentImageUrl (from server)
      if (!preview || !preview.startsWith('data:')) {
        setPreview(currentImageUrl);
      }
    } else if (!currentImageUrl || currentImageUrl === '') {
      // Clear preview only if no file is selected (no data URL preview)
      if (!preview || !preview.startsWith('data:')) {
        setPreview(null);
      }
    }
  }, [currentImageUrl]);

  const validateFile = (file: File): boolean => {
    // Check file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError(`Invalid file type. Allowed: ${allowedTypes.join(", ")}`);
      return false;
    }

    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!validateFile(file)) {
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      onImageSelect(file);
    },
    [onImageSelect, maxSizeMB]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onImageRemove?.();
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Preview and Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {preview || currentImageUrl ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={preview || currentImageUrl} />
                <AvatarFallback>
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              {!disabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                  onClick={handleRemove}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                onClick={handleButtonClick}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Change Photo
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1">
                {isDragging ? "Drop image here" : "Upload profile picture"}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Drag and drop or click to browse
              </p>
              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleButtonClick}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Select Image
                </Button>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Maximum file size: {maxSizeMB}MB. Supported formats: JPG, PNG, GIF, WebP
      </p>
    </div>
  );
}
