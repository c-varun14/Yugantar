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

  React.useEffect(() => {
    if (html) {
      setIsIframeLoading(true);
    }
  }, [html]);

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
      const recordDuration = 20000; // 20 seconds max
      // Start recording (let the browser decide chunk timing). Using no timeslice
      // tends to be more reliable across browsers and avoids 0-byte blobs.
      recorder.start();

      // Stop recording after duration or when animation completes
      setTimeout(() => {
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
        const blob = new Blob(chunks, {
          type: selectedMimeType || "video/webm",
        });

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
    } catch (error) {
      console.error("Failed to download animation:", error);
      alert("Failed to download animation. Please try again.");
      setIsDownloading(false);
    }
  };

  const containerClasses = cn(
    "relative flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-lg backdrop-blur",
    isFullscreen &&
      "fixed inset-4 z-40 h-auto w-auto bg-background/95 p-4 shadow-2xl border-border/80"
  );

  return (
    <Card className={containerClasses}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground">
            Preview
          </span>
          {warning && (
            <span className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {warning}
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

      <div className="relative mt-2 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
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
            <div className="flex items-center justify-center w-full h-full bg-muted/20">
              <iframe
                ref={iframeRef}
                className="h-[50vh] w-full max-w-4xl border-0 bg-background lg:h-[500px]"
                srcDoc={html}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => setIsIframeLoading(false)}
                title="Generated visualization preview"
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
