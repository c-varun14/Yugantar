"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HTMLRenderer } from "@/components/HTMLRenderer";
import { CodeViewerModal } from "@/components/CodeViewerModal";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface GenerationEntry {
  prompt: string;
  html: string;
  createdAt: number;
  durationMs: number;
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
  const [generatedHTML, setGeneratedHTML] = useState<string | null>(null);
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [history, setHistory] = useState<GenerationEntry[]>([]);
  const [lastGenerationDurationMs, setLastGenerationDurationMs] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!inputPrompt.trim() || isLoading) return;

    setError(null);
    setApiWarning(null);
    setIsLoading(true);
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/generate-visualization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: inputPrompt.trim() }),
      });

      const data = (await response.json()) as { code: string; error?: string };

      if (!response.ok || !data.code) {
        setGeneratedHTML(null);
        setError(data.error || "Failed to generate visualization.");
        return;
      }

      const finishedAt = Date.now();
      const durationMs = finishedAt - startedAt;
      setLastGenerationDurationMs(durationMs);

      setGeneratedHTML(data.code);
      setApiWarning(data.error ?? null);

      setHistory((prev) => {
        const next: GenerationEntry[] = [
          { prompt: inputPrompt.trim(), html: data.code, createdAt: finishedAt, durationMs },
          ...prev,
        ];
        return next.slice(0, 5);
      });
    } catch (err) {
      console.error("Error calling generate-visualization API", err);
      setGeneratedHTML(null);
      setError("Unexpected error while generating visualization. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [inputPrompt, isLoading]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void handleGenerate();
    }
  };

  const handleUseExample = (example: string) => {
    setInputPrompt(example);
    setError(null);
  };

  const handleUndoToHistory = (entry: GenerationEntry) => {
    setInputPrompt(entry.prompt);
    setGeneratedHTML(entry.html);
    setError(null);
    setApiWarning(null);
    setLastGenerationDurationMs(entry.durationMs);
  };

  const handleRegenerate = () => {
    void handleGenerate();
  };

  const generationTimeLabel =
    lastGenerationDurationMs != null
      ? `Generated in ${(lastGenerationDurationMs / 1000).toFixed(2)}s`
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/80 to-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:gap-6 lg:py-10">
        {/* Left: Input + history */}
        <section className="flex w-full flex-col gap-4 lg:w-1/3">
          <Card className="flex flex-1 flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-lg backdrop-blur">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold tracking-tight lg:text-xl">
                  Text → Visualization
                </h1>
                <p className="mt-1 text-xs text-muted-foreground lg:text-sm">
                  Describe a visualization you want to see. We&apos;ll generate a standalone HTML page using
                  D3, p5.js, or vanilla JS.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleUseExample(prompt)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    "border-border/60 bg-muted/60 text-muted-foreground hover:bg-muted",
                    "transition-colors",
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="prompt">
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
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground lg:text-xs">
                  <span>Press</span>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                    Ctrl / ⌘ + Enter
                  </kbd>
                  <span>to generate</span>
                </div>
                <div className="flex items-center gap-2">
                  {generationTimeLabel && (
                    <span className="text-[10px] text-muted-foreground lg:text-xs">
                      {generationTimeLabel}
                    </span>
                  )}
                  <Button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={isLoading || !inputPrompt.trim()}
                    className="rounded-full px-4 text-sm font-medium"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        Generating visualization...
                      </span>
                    ) : (
                      "Generate Visualization"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </Card>

          {history.length > 0 && (
            <Card className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/80 p-3 text-xs shadow-md backdrop-blur lg:text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">Recent generations</span>
                <span className="text-[10px] text-muted-foreground">Click to restore</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((entry, index) => (
                  <Badge
                    key={`${entry.createdAt}-${index}`}
                    variant="outline"
                    className="max-w-full cursor-pointer truncate rounded-full border-border/60 bg-muted/40 px-2 py-1 text-[10px] lg:text-xs"
                    onClick={() => handleUndoToHistory(entry)}
                  >
                    {entry.prompt}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </section>

        {/* Right: Preview */}
        <section className="mt-4 flex w-full flex-1 flex-col lg:mt-0 lg:w-2/3">
          <HTMLRenderer
            html={generatedHTML}
            warning={apiWarning}
            onRegenerate={generatedHTML ? handleRegenerate : undefined}
            onViewCode={generatedHTML ? () => setShowCodeModal(true) : undefined}
          />
        </section>
      </main>

      <CodeViewerModal
        open={showCodeModal}
        onOpenChange={setShowCodeModal}
        code={generatedHTML ?? ""}
      />
    </div>
  );
}
