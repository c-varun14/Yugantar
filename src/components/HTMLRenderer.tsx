"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, RefreshCcw, Eye, Download, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface HTMLRendererProps {
  html: string | null;
  warning?: string | null;
  onRegenerate?: () => void;
  onViewCode?: () => void;
}

export function HTMLRenderer({ html, warning, onRegenerate, onViewCode }: HTMLRendererProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isIframeLoading, setIsIframeLoading] = React.useState(false);

  React.useEffect(() => {
    if (html) {
      setIsIframeLoading(true);
    }
  }, [html]);

  const handleDownload = () => {
    if (!html) return;

    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "visualization.html";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download HTML", error);
    }
  };

  const containerClasses = cn(
    "relative flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-lg backdrop-blur",
    isFullscreen &&
      "fixed inset-4 z-40 h-auto w-auto bg-background/95 p-4 shadow-2xl border-border/80",
  );

  return (
    <Card className={containerClasses}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground">Preview</span>
          {warning && (
            <span className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {warning}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
              View Code
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!html}
          >
            <Download className="mr-1 h-3 w-3" />
            Download
          </Button>
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
              Enter a prompt on the left (e.g. sorting algorithm, math concept, data plot) and
              generate a stand-alone HTML visualization.
            </p>
          </div>
        ) : (
          <>
            {isIframeLoading && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <div className="flex flex-col items-center gap-2">
                  <Spinner className="h-6 w-6" />
                  <span className="text-xs text-muted-foreground">Rendering visualization...</span>
                </div>
              </div>
            )}
            <iframe
              className="h-[60vh] w-full border-0 bg-background lg:h-[calc(100vh-10rem)]"
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => setIsIframeLoading(false)}
              title="Generated visualization preview"
            />
          </>
        )}
      </div>
    </Card>
  );
}
