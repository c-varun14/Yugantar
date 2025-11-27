"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface CodeViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
}

export function CodeViewerModal({ open, onOpenChange, code }: CodeViewerModalProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy code to clipboard", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-border/60 bg-background/80 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Generated HTML Code</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={handleCopy}
            >
              {hasCopied ? "Copied" : "Copy"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="mt-4 max-h-[70vh] rounded-md border border-border/60 bg-muted/40 p-2">
          <SyntaxHighlighter
            language="html"
            style={oneDark}
            showLineNumbers
            wrapLines
            customStyle={{
              margin: 0,
              background: "transparent",
              fontSize: "0.8rem",
            }}
            codeTagProps={{
              className: cn("font-mono"),
            }}
          >
            {code}
          </SyntaxHighlighter>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
