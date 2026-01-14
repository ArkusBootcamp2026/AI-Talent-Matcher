import { cn } from "@/lib/utils";

interface MatchScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function MatchScore({ score, size = "md", showLabel = true, className }: MatchScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-success";
    if (score >= 70) return "text-primary";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 85) return "from-success to-accent";
    if (score >= 70) return "from-primary to-secondary";
    if (score >= 50) return "from-warning to-warning/70";
    return "from-destructive to-destructive/70";
  };

  const sizeClasses = {
    sm: "w-12 h-12 text-sm",
    md: "w-16 h-16 text-lg",
    lg: "w-24 h-24 text-2xl",
  };

  const strokeWidth = size === "sm" ? 4 : size === "md" ? 5 : 6;
  const radius = size === "sm" ? 20 : size === "md" ? 26 : 40;
  const circumference = 2 * Math.PI * radius;
  const progress = ((100 - score) / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            className="transition-all duration-700 ease-out"
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className={cn("stop-color-current", getScoreColor(score))} stopColor="hsl(var(--primary))" />
              <stop offset="100%" className={cn("stop-color-current", getScoreColor(score))} stopColor="hsl(var(--secondary))" />
            </linearGradient>
          </defs>
        </svg>
        <div className={cn(
          "absolute inset-0 flex items-center justify-center font-bold",
          getScoreColor(score)
        )}>
          {Math.round(score)}%
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground font-medium">Match Score</span>
      )}
    </div>
  );
}