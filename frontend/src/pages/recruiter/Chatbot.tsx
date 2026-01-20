import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AILoadingIndicator } from "@/components/shared/AILoadingIndicator";
import {
  Send,
  Brain,
  User,
  Sparkles,
  Lightbulb,
  Users,
  Code,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface Message {
  id: number;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

const suggestedPrompts = [
  { icon: Users, text: "Show me top React developers" },
  { icon: Code, text: "Find candidates with AWS experience" },
  { icon: TrendingUp, text: "Who has the highest match score for Frontend roles?" },
  { icon: Lightbulb, text: "Summarize skills across all candidates" },
];

const mockResponses: Record<string, string> = {
  "react": "I found **24 candidates** with React experience. Here are the top matches:\n\n1. **Sarah Chen** (94% match) - Senior React Developer with 8 years experience\n2. **Michael Johnson** (89% match) - Full Stack Engineer specializing in React\n3. **James Wilson** (78% match) - React Native Developer\n\nWould you like me to provide more details about any of these candidates?",
  "aws": "I identified **12 candidates** with AWS experience:\n\n• **5 candidates** have AWS Solutions Architect certification\n• **8 candidates** have hands-on experience with EC2, S3, and Lambda\n• **3 candidates** have expertise in AWS DevOps practices\n\nThe strongest AWS candidates are:\n1. Sarah Chen - AWS experience for 3+ years\n2. David Park - AWS certified architect\n\nShall I show their full profiles?",
  "highest": "Based on the current candidate pool for **Frontend roles**, here are the top scorers:\n\n🥇 **Sarah Chen** - 94% match\n   - 8 years experience, Expert in React/TypeScript\n\n🥈 **Michael Johnson** - 89% match\n   - 6 years experience, Full Stack expertise\n\n🥉 **Emily Davis** - 85% match\n   - 4 years experience, Vue.js specialist\n\nAll three candidates are currently in active consideration. Would you like to schedule interviews?",
  "summarize": "Here's a **skill distribution analysis** across your candidate pool:\n\n**Most Common Skills:**\n• JavaScript/TypeScript - 87% of candidates\n• React - 72% of candidates\n• Node.js - 58% of candidates\n• Python - 45% of candidates\n• AWS - 38% of candidates\n\n**Skill Gaps Identified:**\n• Only 15% have GraphQL experience\n• 12% have Kubernetes expertise\n• Senior-level candidates (5+ years): 34%\n\nWould you like recommendations for sourcing candidates with specific skills?",
};

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "ai",
      content: "Hello! I'm your AI recruitment assistant. I can help you search through your candidate database, analyze skills, and provide insights. What would you like to know?",
      timestamp: new Date(),
      suggestions: ["Show top candidates", "Skill analysis", "Pipeline overview"],
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
    if (lowerQuery.includes("react")) return mockResponses["react"];
    if (lowerQuery.includes("aws")) return mockResponses["aws"];
    if (lowerQuery.includes("highest") || lowerQuery.includes("top") || lowerQuery.includes("score")) return mockResponses["highest"];
    if (lowerQuery.includes("summarize") || lowerQuery.includes("skill") || lowerQuery.includes("analysis")) return mockResponses["summarize"];
    return "I understand you're looking for information about candidates. Could you be more specific? You can ask me about:\n\n• Specific skills or technologies\n• Match scores and rankings\n• Candidate availability\n• Skill distribution analysis\n\nTry asking something like \"Show me candidates with Python experience\" or \"Who are the top matches for the Frontend role?\"";
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

    // Simulate AI response delay
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
          <strong className="font-semibold">Feature Preview:</strong> This AI Chatbot functionality is currently under development and serves as a preview of an upcoming feature. The interface and responses are simulated for demonstration purposes only.
        </AlertDescription>
      </Alert>

      <div className="h-[calc(100vh-12rem)] flex gap-6">
        {/* Chat Area */}
        <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b p-4 pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-base font-semibold">AI Recruitment Assistant</h2>
              <p className="text-xs text-muted-foreground font-normal">
                Query your candidate database with natural language
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
                        ? "bg-gradient-to-br from-primary to-secondary text-primary-foreground"
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
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                    <Sparkles className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <AILoadingIndicator text="Thinking..." />
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
              placeholder="Ask about candidates, skills, or insights..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Sidebar - Suggested Prompts */}
      <div className="w-80 hidden lg:block space-y-3 flex-shrink-0">
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-warning" />
              Suggested Prompts
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
                <span className="text-sm text-left break-words">{prompt.text}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Candidates</span>
              <span className="font-semibold">248</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg. Match Score</span>
              <span className="font-semibold text-primary">78%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New This Week</span>
              <span className="font-semibold text-success">+34</span>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}