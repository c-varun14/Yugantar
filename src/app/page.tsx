"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { HTMLRenderer } from "@/components/HTMLRenderer";
import { CodeViewerModal } from "@/components/CodeViewerModal";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, MessageSquare, AlertCircle, X } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: Array<{
    prompt: string;
    html: string | null;
    createdAt: number;
  }>;
}

const EXAMPLE_PROMPTS: string[] = [
  "Animate the Pythagoras theorem with growing squares",
  "Show vector addition visually using arrows",
  "Demonstrate bubble sort with colored bars",
  "Plot a sine wave and highlight maxima/minima",
  "Visualize binary search tree insertion",
  "Show collision detection between circles",
];

export default function HomePage() {
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingInstructions, setIsGeneratingInstructions] =
    useState(false);
  const [generatedHTML, setGeneratedHTML] = useState<string | null>(null);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [animationInstructions, setAnimationInstructions] =
    useState<string>("");
  const [showInstructionsSheet, setShowInstructionsSheet] = useState(false);
  const [narrativeGuide, setNarrativeGuide] = useState<{
    introduction?: string;
    steps?: Array<{
      timestamp: number;
      timeInSeconds: number;
      text: string;
      highlight?: string;
    }>;
    conclusion?: string;
  } | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [historySortBy, setHistorySortBy] = useState<
    "recent" | "oldest" | "title"
  >("recent");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const generateVisualizationFromInstructions = useCallback(
    async (instructions: string) => {
      if (!instructions.trim()) {
        setError("No animation instructions generated.");
        return;
      }

      setIsLoading(true);

      try {
        // Parse instructions to get narrative guide if available
        let narrativeGuideData = null;
        try {
          const parsed = JSON.parse(instructions.trim());
          if (parsed.narrativeGuide) {
            narrativeGuideData = parsed.narrativeGuide;
          }
        } catch {
          // Not JSON, continue with raw instructions
        }

        const response = await fetch("/api/generate-visualization", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instructions: instructions.trim(),
            narrativeGuide: narrativeGuideData,
          }),
        });

        const data = (await response.json()) as {
          code: string;
          error?: string;
        };

        if (!response.ok || !data.code) {
          setGeneratedHTML(null);
          setError(data.error || "Failed to generate visualization.");
          return;
        }

        const finishedAt = Date.now();

        setGeneratedHTML(data.code);
        setApiWarning(data.error ?? null);

        // Add to current conversation or create new one
        setConversations((prev) => {
          const conversationId = currentConversationId;
          if (conversationId) {
            return prev.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    messages: [
                      ...conv.messages,
                      {
                        prompt: inputPrompt.trim(),
                        html: data.code,
                        createdAt: finishedAt,
                      },
                    ],
                  }
                : conv
            );
          } else {
            const newConv: Conversation = {
              id: `conv-${finishedAt}`,
              title: inputPrompt.trim().slice(0, 50),
              createdAt: finishedAt,
              messages: [
                {
                  prompt: inputPrompt.trim(),
                  html: data.code,
                  createdAt: finishedAt,
                },
              ],
            };
            setCurrentConversationId(newConv.id);
            return [newConv, ...prev];
          }
        });
      } catch (err) {
        console.error("Error calling generate-visualization API", err);
        setGeneratedHTML(null);
        setError(
          "Unexpected error while generating visualization. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [inputPrompt, currentConversationId]
  );

  const streamInstructions = useCallback(
    async (prompt: string) => {
      setError(null);
      setAnimationInstructions("");
      setNarrativeGuide(null);
      setIsGeneratingInstructions(true);

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch("/api/generate-instructions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to generate instructions");
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode the chunk and accumulate text
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          setAnimationInstructions(accumulatedText);

          // Try to parse JSON incrementally to extract narrative guide
          try {
            // Try to find complete JSON object
            const jsonMatch = accumulatedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.narrativeGuide) {
                setNarrativeGuide(parsed.narrativeGuide);
              }
            }
          } catch (error) {
            // Partial JSON, continue accumulating
          }
        }

        // Once streaming is complete, parse and extract narrative guide
        setIsGeneratingInstructions(false);

        // Final parse attempt
        try {
          const parsed = JSON.parse(accumulatedText);
          if (parsed.narrativeGuide) {
            setNarrativeGuide(parsed.narrativeGuide);
          }
        } catch {
          // If JSON parsing fails, the instructions might be malformed
          // but we'll still try to generate visualization
          // Continue with accumulated text
        }

        await generateVisualizationFromInstructions(accumulatedText);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was aborted, ignore
          return;
        }
        console.error("Error streaming instructions:", error);
        setError(
          "Failed to generate animation instructions. Please try again."
        );
        setIsGeneratingInstructions(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [generateVisualizationFromInstructions]
  );

  const handleGenerate = useCallback(async () => {
    if (!inputPrompt.trim() || isLoading || isGeneratingInstructions) return;

    setError(null);
    setApiWarning(null);
    setGeneratedHTML(null);

    // Start streaming instructions
    await streamInstructions(inputPrompt.trim());
  }, [inputPrompt, isLoading, isGeneratingInstructions, streamInstructions]);

  const handleStopInstructions = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGeneratingInstructions(false);
    }
  }, []);

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    event
  ) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void handleGenerate();
    }
  };

  const handleUseExample = (example: string) => {
    setInputPrompt(example);
    setError(null);
  };

  const handleRegenerate = () => {
    void handleGenerate();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const sortedConversations = React.useMemo(() => {
    const sorted = [...conversations];
    switch (historySortBy) {
      case "recent":
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      case "oldest":
        return sorted.sort((a, b) => a.createdAt - b.createdAt);
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  }, [conversations, historySortBy]);

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setInputPrompt("");
    setGeneratedHTML(null);
    setError(null);
    setApiWarning(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/80 to-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:gap-6 lg:py-10">
        {/* Left: Input */}
        <section className="flex w-full flex-col gap-4 lg:w-2/5">
          <Card className="flex flex-1 flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h1 className="text-lg font-semibold tracking-tight lg:text-xl">
                  Text → Visualization
                </h1>
                <p className="mt-1 text-xs text-muted-foreground lg:text-sm">
                  Describe a visualization you want to see.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistorySheet(true)}
                  className="h-8"
                >
                  <History className="h-4 w-4" />
                </Button>
                {currentConversationId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={startNewConversation}
                    className="h-8"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.slice(0, 3).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleUseExample(prompt)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    "border-border/60 bg-muted/60 text-muted-foreground hover:bg-muted",
                    "transition-colors"
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-2">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="prompt"
              >
                Prompt
              </label>
              <Textarea
                id="prompt"
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  "e.g. Animate the Pythagoras theorem with growing squares, or visualize bubble sort with colored bars."
                }
                className="min-h-[160px] flex-1 resize-none rounded-xl border-border/60 bg-background/80 shadow-inner focus-visible:ring-1"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={
                    isLoading || isGeneratingInstructions || !inputPrompt.trim()
                  }
                  className="rounded-full px-4 text-sm font-medium"
                >
                  {isGeneratingInstructions || isLoading ? (
                    <span className="flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      Generating...
                    </span>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isGeneratingInstructions && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/60 bg-primary/10 px-3 py-2 text-xs text-primary">
                <Spinner className="h-4 w-4" />
                <span>Generating animation instructions...</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleStopInstructions}
                  className="ml-auto h-6 px-2 text-[10px]"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </Card>
        </section>

        {/* Right: Preview */}
        <section className="mt-4 flex w-full flex-1 flex-col lg:mt-0 lg:w-3/5">
          {isGeneratingInstructions || (narrativeGuide && !generatedHTML) ? (
            <Card className="flex flex-1 flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-muted-foreground">
                    Animation Guide
                  </span>
                  {isGeneratingInstructions && (
                    <span className="mt-1 text-xs text-primary">
                      Generating guide...
                    </span>
                  )}
                  {!isGeneratingInstructions && isLoading && (
                    <span className="mt-1 text-xs text-muted-foreground">
                      Generating visualization preview...
                    </span>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 rounded-lg border border-border/40 bg-muted/20 p-4">
                {narrativeGuide ? (
                  <div className="flex flex-col gap-4 pr-4">
                    {narrativeGuide.introduction && (
                      <div className="rounded-lg border border-border/40 bg-background/60 p-4">
                        <p className="text-sm font-semibold text-foreground mb-2">
                          Introduction
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {narrativeGuide.introduction}
                        </p>
                      </div>
                    )}

                    {narrativeGuide.steps &&
                      narrativeGuide.steps.length > 0 && (
                        <div className="flex flex-col gap-3">
                          <p className="text-sm font-semibold text-foreground">
                            Steps ({narrativeGuide.steps.length})
                          </p>
                          <div className="flex flex-col gap-3">
                            {narrativeGuide.steps.map((step, index) => (
                              <div
                                key={index}
                                className="rounded-lg border border-border/40 bg-background/60 p-4"
                              >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="text-xs font-mono font-semibold text-primary">
                                    {formatTime(step.timeInSeconds)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Step {index + 1}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground mb-2">
                                  {step.text}
                                </p>
                                {step.highlight && (
                                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                                    {step.highlight}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {narrativeGuide.conclusion && (
                      <div className="rounded-lg border border-border/40 bg-background/60 p-4">
                        <p className="text-sm font-semibold text-foreground mb-2">
                          Conclusion
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {narrativeGuide.conclusion}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex flex-col items-center gap-2">
                      <Spinner className="h-6 w-6" />
                      <span className="text-xs text-muted-foreground">
                        Generating guide...
                      </span>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </Card>
          ) : (
            <HTMLRenderer
              html={generatedHTML}
              warning={apiWarning}
              onRegenerate={generatedHTML ? handleRegenerate : undefined}
              onViewCode={
                generatedHTML ? () => setShowCodeModal(true) : undefined
              }
              onViewInstructions={
                narrativeGuide || animationInstructions
                  ? () => setShowInstructionsSheet(true)
                  : undefined
              }
            />
          )}
        </section>
      </main>

      {/* Instructions Sheet */}
      <Sheet
        open={showInstructionsSheet}
        onOpenChange={setShowInstructionsSheet}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Animation Guide</SheetTitle>
            <SheetDescription>
              Step-by-step guide for the visualization
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-8rem)]">
            {narrativeGuide ? (
              <div className="flex flex-col gap-4 pr-4">
                {narrativeGuide.introduction && (
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                    <p className="text-sm font-semibold text-foreground mb-2">
                      Introduction
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {narrativeGuide.introduction}
                    </p>
                  </div>
                )}

                {narrativeGuide.steps && narrativeGuide.steps.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      Steps ({narrativeGuide.steps.length})
                    </p>
                    <div className="flex flex-col gap-3">
                      {narrativeGuide.steps.map((step, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-border/40 bg-background/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-mono font-semibold text-primary">
                              {formatTime(step.timeInSeconds)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Step {index + 1}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mb-2">
                            {step.text}
                          </p>
                          {step.highlight && (
                            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                              {step.highlight}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {narrativeGuide.conclusion && (
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                    <p className="text-sm font-semibold text-foreground mb-2">
                      Conclusion
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {narrativeGuide.conclusion}
                    </p>
                  </div>
                )}
              </div>
            ) : animationInstructions ? (
              <div className="pr-4">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <pre className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
                    {animationInstructions}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                No instructions available
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* History Sheet */}
      <Sheet open={showHistorySheet} onOpenChange={setShowHistorySheet}>
        <SheetContent side="left" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Conversation History</SheetTitle>
            <SheetDescription>
              View and continue previous conversations
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <Tabs
              value={historySortBy}
              onValueChange={(v) =>
                setHistorySortBy(v as "recent" | "oldest" | "title")
              }
            >
              <TabsList className="w-full">
                <TabsTrigger value="recent" className="flex-1">
                  Recent
                </TabsTrigger>
                <TabsTrigger value="oldest" className="flex-1">
                  Oldest
                </TabsTrigger>
                <TabsTrigger value="title" className="flex-1">
                  Title
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <ScrollArea className="h-[calc(100vh-12rem)]">
              {sortedConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground">
                  <History className="h-8 w-8 mb-2 opacity-50" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pr-4">
                  {sortedConversations.map((conv) => (
                    <Card
                      key={conv.id}
                      className={cn(
                        "p-3 cursor-pointer transition-colors hover:bg-muted/50",
                        currentConversationId === conv.id &&
                          "border-primary bg-primary/5"
                      )}
                      onClick={() => {
                        setCurrentConversationId(conv.id);
                        if (conv.messages.length > 0) {
                          const lastMessage =
                            conv.messages[conv.messages.length - 1];
                          setInputPrompt(lastMessage.prompt);
                          setGeneratedHTML(lastMessage.html);
                        }
                        setShowHistorySheet(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {conv.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {conv.messages.length} message
                            {conv.messages.length !== 1 ? "s" : ""} •{" "}
                            {formatDate(conv.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <CodeViewerModal
        open={showCodeModal}
        onOpenChange={setShowCodeModal}
        code={generatedHTML ?? ""}
      />
    </div>
  );
}
