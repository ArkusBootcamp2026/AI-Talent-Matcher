import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AILoadingIndicator } from "@/components/shared/AILoadingIndicator";
import { MatchScore } from "@/components/shared/MatchScore";
import {
  Send,
  Brain,
  User,
  Sparkles,
  Lightbulb,
  GraduationCap,
  Target,
  FileText,
  ArrowRight,
  BookOpen,
  Award,
  AlertTriangle,
} from "lucide-react";

interface Message {
  id: number;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface JobWithGap {
  id: number;
  title: string;
  company: string;
  matchScore: number;
  missingSkills: string[];
}

const suggestedPrompts = [
  { icon: Target, text: "How can I reach 100% match for Senior Frontend Developer?" },
  { icon: GraduationCap, text: "What certifications should I get for cloud roles?" },
  { icon: BookOpen, text: "Suggest courses for my missing skills" },
  { icon: Award, text: "What skills are most in-demand right now?" },
];

// Mock jobs with skill gaps
const jobsWithGaps: JobWithGap[] = [
  {
    id: 1,
    title: "Senior Frontend Developer",
    company: "TechCorp Inc.",
    matchScore: 65,
    missingSkills: ["GraphQL", "Next.js", "Testing (Jest)"],
  },
  {
    id: 2,
    title: "Cloud Engineer",
    company: "CloudSoft",
    matchScore: 58,
    missingSkills: ["AWS Certified", "Kubernetes", "Terraform"],
  },
];

const mockResponses: Record<string, string> = {
  "100%": `Great question! To reach **100% match** for the Senior Frontend Developer role at TechCorp Inc., you need to acquire these **3 missing skills**:

1. **GraphQL** 
   📚 Recommended: "GraphQL Fundamentals" on Udemy (~8 hours)
   
2. **Next.js**
   📚 Recommended: "Next.js & React - The Complete Guide" on Udemy
   
3. **Testing (Jest)**
   📚 Recommended: "Testing React with Jest and Testing Library" on Pluralsight

**Estimated time to completion:** 2-3 weeks with dedicated study.

Once you've completed these, click "Update CV" to upload your updated resume and I'll recalculate your match score! 🎯`,

  "certification": `Based on current market demand, here are the **top certifications** for cloud roles:

🏆 **AWS Certifications (Most In-Demand)**
- AWS Solutions Architect Associate (~$150, 3-4 weeks prep)
- AWS Cloud Practitioner (Entry level, ~$100)

🏆 **Azure Certifications**
- Azure Fundamentals AZ-900 (Entry level)
- Azure Administrator AZ-104

🏆 **Google Cloud**
- Google Cloud Associate Cloud Engineer

**My recommendation:** Start with AWS Solutions Architect Associate - it's the most recognized and will open the most doors for you.

Would you like specific study resources for any of these?`,

  "courses": `Based on your profile analysis, here are **personalized course recommendations** for your missing skills:

**High Priority (Frequently Required):**
1. **GraphQL** - "The Modern GraphQL Bootcamp" (Udemy) - ⭐ 4.8
2. **Docker & Kubernetes** - "Docker and Kubernetes: The Complete Guide" - ⭐ 4.7

**Medium Priority:**
3. **Next.js** - Official Next.js Learn Course (Free!)
4. **TypeScript Advanced** - "Advanced TypeScript" on Frontend Masters

**Quick Wins (< 1 week):**
5. **Jest Testing** - "JavaScript Testing Introduction" (Free on YouTube)

Would you like me to create a personalized learning roadmap?`,

  "in-demand": `Here are the **most in-demand skills** in 2024 based on job postings:

📈 **Frontend Development:**
- React/Next.js (present in 78% of listings)
- TypeScript (67%)
- GraphQL (growing 45% YoY)

📈 **Cloud & DevOps:**
- AWS (most requested cloud platform)
- Kubernetes (53% increase in demand)
- Terraform (infrastructure as code)

📈 **AI/ML Skills:**
- Python for ML
- LLM Integration
- AI-powered development tools

**Your strongest areas:** React, JavaScript, CSS
**Biggest opportunity:** Adding GraphQL and cloud skills could increase your match rate by ~25%!`,
};

export default function SkillCoach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "ai",
      content: `Hello! I'm your **AI Skill Coach**. I've analyzed your profile and found some opportunities to improve your match scores.

I noticed you have **${jobsWithGaps.length} jobs** where you're close to being a perfect match. Let me help you bridge the skill gaps and reach **100% match**!

What would you like to work on today?`,
      timestamp: new Date(),
      suggestions: ["Improve my match scores", "Suggest certifications", "Create learning plan"],
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getAIResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes("100%") || lowerQuery.includes("reach") || lowerQuery.includes("match") || lowerQuery.includes("improve")) 
      return mockResponses["100%"];
    if (lowerQuery.includes("certification") || lowerQuery.includes("certif") || lowerQuery.includes("cloud")) 
      return mockResponses["certification"];
    if (lowerQuery.includes("course") || lowerQuery.includes("learn") || lowerQuery.includes("missing") || lowerQuery.includes("suggest")) 
      return mockResponses["courses"];
    if (lowerQuery.includes("demand") || lowerQuery.includes("popular") || lowerQuery.includes("trending")) 
      return mockResponses["in-demand"];
    
    return `I can help you improve your skills and match scores! Here's what I can assist with:

• **Skill Gap Analysis** - Identify what's missing for specific jobs
• **Course Recommendations** - Personalized learning paths
• **Certification Guidance** - Which certifications matter most
• **Market Insights** - What skills are trending

Try asking "How can I reach 100% match?" or "What certifications should I get?"`;
  };

  const handleSend = (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: messages.length + 2,
        type: "ai",
        content: getAIResponse(messageText),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Warning Banner */}
      <Alert variant="default" className="border-warning/50 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-sm text-foreground">
          <strong className="font-semibold">Feature Preview:</strong> This AI Skill Coach functionality is currently under development and serves as a preview of an upcoming feature. The interface and responses are simulated for demonstration purposes only.
        </AlertDescription>
      </Alert>

      <div className="h-[calc(100vh-12rem)] flex gap-6">
        {/* Chat Area */}
        <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Skill Coach</h2>
              <p className="text-sm text-muted-foreground font-normal">
                Get personalized advice to reach 100% match
              </p>
            </div>
          </CardTitle>
        </CardHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === "user" ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback
                    className={
                      message.type === "ai"
                        ? "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                        : "bg-muted"
                    }
                  >
                    {message.type === "ai" ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.type === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                >
                  <div
                    className="text-sm whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br />"),
                    }}
                  />
                  {message.suggestions && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.suggestions.map((suggestion) => (
                        <Badge
                          key={suggestion}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10"
                          onClick={() => handleSend(suggestion)}
                        >
                          {suggestion}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                    <Sparkles className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <AILoadingIndicator text="Analyzing..." />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Ask about skills, courses, or certifications..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Sidebar */}
      <div className="w-80 hidden lg:block space-y-3 flex-shrink-0">
        {/* Jobs with Skill Gaps */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-warning" />
              Jobs Within Reach
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {jobsWithGaps.map((job) => (
              <div
                key={job.id}
                className="p-3 rounded-lg bg-muted/50 space-y-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.company}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleSend(`How can I reach 100% match for ${job.title}?`)}
                >
                  Get improvement plan <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Suggested Prompts */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              Try Asking
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            {suggestedPrompts.map((prompt, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full justify-start text-left h-auto py-2 px-2 whitespace-normal"
                onClick={() => handleSend(prompt.text)}
              >
                <prompt.icon className="w-4 h-4 mr-2 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-xs text-left break-words">{prompt.text}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
