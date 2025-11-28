"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Maximize2,
  Minimize2,
  RefreshCcw,
  Eye,
  AlertCircle,
  Video,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface HTMLRendererProps {
  html: string | null;
  warning?: string | null;
  onRegenerate?: () => void;
  onViewCode?: () => void;
  onViewInstructions?: () => void;
}

export function HTMLRenderer({
  html,
  warning,
  onRegenerate,
  onViewCode,
  onViewInstructions,
}: HTMLRendererProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isIframeLoading, setIsIframeLoading] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (html) {
      setIsIframeLoading(true);
    }
  }, [html]);


  // Adjust iframe height in fullscreen mode to show all content including controls
  React.useEffect(() => {
    if (isFullscreen && iframeRef.current && !isIframeLoading) {
      const adjustIframeHeight = () => {
        try {
          const iframe = iframeRef.current;
          if (!iframe) return;
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const body = iframeDoc.body;
            const htmlElement = iframeDoc.documentElement;
            
            // Get the canvas element and ensure it has max-height: 70vh
            const canvas = iframeDoc.querySelector('canvas#animationCanvas') as HTMLCanvasElement;
            if (canvas) {
              const canvasStyle = canvas.style;
              if (!canvasStyle.maxHeight || !canvasStyle.maxHeight.includes('70vh')) {
                canvasStyle.maxHeight = '70vh';
                canvasStyle.width = '100%';
                canvasStyle.height = 'auto';
                canvasStyle.objectFit = 'contain';
              }
            }
            
            // Get the actual content height including controls
            const scrollHeight = Math.max(
              body?.scrollHeight || 0,
              htmlElement?.scrollHeight || 0
            );
            const offsetHeight = Math.max(
              body?.offsetHeight || 0,
              htmlElement?.offsetHeight || 0
            );
            const height = Math.max(scrollHeight, offsetHeight);
            
            if (height > 0) {
              // Use the full content height, but ensure it fits in viewport
              // Reserve space for header (about 80px) and padding
              const availableHeight = window.innerHeight - 120;
              const finalHeight = Math.min(height + 20, availableHeight);
              iframe.style.height = `${finalHeight}px`;
              iframe.style.maxHeight = `${availableHeight}px`;
            } else {
              // Fallback: use a reasonable default that should show controls
              const availableHeight = window.innerHeight - 120;
              iframe.style.height = `${availableHeight}px`;
              iframe.style.maxHeight = `${availableHeight}px`;
            }
          }
        } catch (e) {
          // Cross-origin or other error, use default sizing
          const availableHeight = window.innerHeight - 120;
          if (iframeRef.current) {
            iframeRef.current.style.height = `${availableHeight}px`;
            iframeRef.current.style.maxHeight = `${availableHeight}px`;
          }
        }
      };

      // Adjust multiple times to catch dynamic content loading
      adjustIframeHeight();
      const timer1 = setTimeout(adjustIframeHeight, 300);
      const timer2 = setTimeout(adjustIframeHeight, 800);
      const timer3 = setTimeout(adjustIframeHeight, 1500);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isFullscreen, isIframeLoading, html]);

  const stepForward = () => {
    if (!iframeRef.current) return;
    try {
      const iframe = iframeRef.current;
      const iframeWindow = iframe.contentWindow;
      const iframeDocument = iframe.contentDocument;

      if (!iframeWindow || !iframeDocument) return;

      // Try to call stepForward function if it exists in the iframe
      try {
        (iframeWindow as any).stepForward?.();
      } catch (e) {
        // If direct call fails, try postMessage
        iframeWindow.postMessage({ type: "stepForward" }, "*");
      }
    } catch (error) {
      console.error("Failed to step forward:", error);
    }
  };

  const stepBackward = () => {
    if (!iframeRef.current) return;
    try {
      const iframe = iframeRef.current;
      const iframeWindow = iframe.contentWindow;
      const iframeDocument = iframe.contentDocument;

      if (!iframeWindow || !iframeDocument) return;

      // Try to call stepBackward function if it exists in the iframe
      try {
        (iframeWindow as any).stepBackward?.();
      } catch (e) {
        // If direct call fails, try postMessage
        iframeWindow.postMessage({ type: "stepBackward" }, "*");
      }
    } catch (error) {
      console.error("Failed to step backward:", error);
    }
  };

  const downloadAnimation = async () => {
    if (!iframeRef.current || !html) return;

    setIsDownloading(true);

    try {
      const iframe = iframeRef.current;
      const iframeWindow = iframe.contentWindow;
      const iframeDocument = iframe.contentDocument;

      if (!iframeWindow || !iframeDocument) {
        throw new Error("Cannot access iframe content");
      }

      // Get the canvas from the iframe
      const canvas = iframeDocument.querySelector(
        "canvas#animationCanvas"
      ) as HTMLCanvasElement;

      if (!canvas) {
        throw new Error("Canvas not found in animation");
      }

      // Ensure animation is playing/reset before recording
      try {
        // Try to reset and play the animation
        if ((iframeWindow as any).resetAnimation) {
          (iframeWindow as any).resetAnimation();
        }
        if ((iframeWindow as any).playAnimation) {
          (iframeWindow as any).playAnimation();
        }
        // Wait a bit for animation to start
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        // Continue even if reset/play fails
        console.warn("Could not reset/play animation:", e);
      }

      // Get canvas stream directly
      const stream = canvas.captureStream(30); // 30 FPS

      // Determine the best mime type
      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      let selectedMimeType = "";
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported video codec found");
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // Wait for animation to complete or record for a fixed duration
      const recordDuration = 25000; // 25 seconds max (increased for longer animations)
      
      // Start recording (let the browser decide chunk timing). Using no timeslice
      // tends to be more reliable across browsers and avoids 0-byte blobs.
      recorder.start();

      // Stop recording after duration or when animation completes
      const stopTimeout = setTimeout(() => {
        if (recorder.state !== "inactive") {
          // Ensure any pending data is flushed before stopping
          try {
            recorder.requestData();
          } catch {
            // Some implementations may not support requestData; ignore.
          }
          recorder.stop();
        }
      }, recordDuration);

      recorder.onstop = () => {
        clearTimeout(stopTimeout);
        const blob = new Blob(chunks, {
          type: selectedMimeType || "video/webm",
        });

        if (blob.size === 0) {
          throw new Error("Recorded video is empty. Please ensure the animation is playing.");
        }

        // Download the video
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `animation-${Date.now()}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Cleanup
        stream.getTracks().forEach((track) => track.stop());
        setIsDownloading(false);
      };

      recorder.onerror = (event) => {
        clearTimeout(stopTimeout);
        console.error("MediaRecorder error:", event);
        stream.getTracks().forEach((track) => track.stop());
        setIsDownloading(false);
        alert("Failed to record animation. Please try again.");
      };
    } catch (error) {
      console.error("Failed to download animation:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to download animation. Please try again."
      );
      setIsDownloading(false);
    }
  };

  const containerClasses = cn(
    "relative flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-lg backdrop-blur",
    isFullscreen &&
      "fixed inset-4 z-50 h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] bg-background/95 p-4 shadow-2xl border-border/80 flex flex-col"
  );

  return (
    <Card className={containerClasses}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground">
            Preview
          </span>
          {warning && (
            <span className="mt-1 flex items-center gap-1 text-xs text-destructive break-words">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span className="break-words">{warning}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onViewInstructions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewInstructions}
            >
              <BookOpen className="mr-1 h-3 w-3" />
              Guide
            </Button>
          )}
          {onRegenerate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegenerate}
            >
              <RefreshCcw className="mr-1 h-3 w-3" />
              Regenerate
            </Button>
          )}
          {onViewCode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewCode}
            >
              <Eye className="mr-1 h-3 w-3" />
              Code
            </Button>
          )}
          {html && (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={stepBackward}
                disabled={!html}
                title="Step backward"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={stepForward}
                disabled={!html}
                title="Step forward"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadAnimation}
                disabled={!html || isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Spinner className="mr-1 h-3 w-3" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Video className="mr-1 h-3 w-3" />
                    Download
                  </>
                )}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen((prev) => !prev)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "relative mt-2 rounded-xl border border-border/60 bg-muted/40",
          isFullscreen 
            ? "flex-1 min-h-0 overflow-y-auto overflow-x-hidden" 
            : "flex-1 overflow-hidden"
        )}
        style={
          isFullscreen
            ? {
                maxHeight: "calc(100vh - 140px)",
              }
            : undefined
        }
      >
        {!html ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <p>Generated visualizations will appear here.</p>
            <p className="max-w-sm text-xs">
              Enter a prompt on the left (e.g. sorting algorithm, math concept,
              data plot) and generate a stand-alone HTML visualization.
            </p>
          </div>
        ) : (
          <>
            {isIframeLoading && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <div className="flex flex-col items-center gap-2">
                  <Spinner className="h-6 w-6" />
                  <span className="text-xs text-muted-foreground">
                    Rendering visualization...
                  </span>
                </div>
              </div>
            )}
            <div
              className={cn(
                "flex items-start justify-center bg-muted/20",
                isFullscreen ? "w-full p-2" : "w-full h-full"
              )}
            >
              <iframe
                ref={iframeRef}
                className={cn(
                  "border-0 bg-background",
                  isFullscreen
                    ? "w-full max-w-[98vw] block"
                    : "h-[50vh] w-full max-w-4xl lg:h-[500px]"
                )}
                srcDoc={html}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => {
                  setIsIframeLoading(false);
                  // Trigger height adjustment after load to ensure canvas has 70vh max-height
                  const adjustHeight = () => {
                    const iframe = iframeRef.current;
                    if (iframe) {
                      try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                          // Ensure canvas has max-height: 70vh
                          const canvas = iframeDoc.querySelector('canvas#animationCanvas') as HTMLCanvasElement;
                          if (canvas) {
                            const canvasStyle = canvas.style;
                            if (!canvasStyle.maxHeight || !canvasStyle.maxHeight.includes('70vh')) {
                              canvasStyle.maxHeight = '70vh';
                              canvasStyle.width = '100%';
                              canvasStyle.height = 'auto';
                              canvasStyle.objectFit = 'contain';
                            }
                          }
                          
                          if (isFullscreen) {
                            // Wait a bit for content to render
                            setTimeout(() => {
                              const body = iframeDoc.body;
                              const htmlEl = iframeDoc.documentElement;
                              const height = Math.max(
                                body?.scrollHeight || 0,
                                body?.offsetHeight || 0,
                                htmlEl?.scrollHeight || 0,
                                htmlEl?.offsetHeight || 0,
                                htmlEl?.clientHeight || 0
                              );
                              if (height > 0) {
                                // Use full height to show controls at top, container will handle scrolling
                                const availableHeight = window.innerHeight - 120;
                                const finalHeight = Math.min(height + 10, availableHeight);
                                iframe.style.height = `${finalHeight}px`;
                                iframe.style.minHeight = `${finalHeight}px`;
                                
                                // Scroll container to top to show controls
                                if (containerRef.current) {
                                  setTimeout(() => {
                                    containerRef.current?.scrollTo({
                                      top: 0,
                                      behavior: 'smooth'
                                    });
                                  }, 300);
                                }
                              }
                            }, 200);
                          }
                        }
                      } catch (e) {
                        // Fallback: use viewport-based height
                        if (isFullscreen) {
                          const availableHeight = window.innerHeight - 120;
                          iframe.style.height = `${availableHeight}px`;
                          iframe.style.minHeight = `${availableHeight}px`;
                        }
                      }
                    }
                  };
                  adjustHeight();
                  // Also adjust after a longer delay for dynamic content
                  setTimeout(adjustHeight, 1000);
                }}
                title="Generated visualization preview"
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
