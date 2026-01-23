"use client";

import { WritingForm } from "@/components/writing-form";
import { OutputPanel } from "@/components/output-panel";
import { HistoryPanel } from "@/components/history-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { History } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import type { HistoryItem } from "@/lib/history";

export default function Home() {
  const [output, setOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const regenerateRef = useRef<(() => void) | null>(null);
  const continueRef = useRef<(() => void) | null>(null);
  const loadHistoryRef = useRef<((item: HistoryItem) => void) | null>(null);

  const handleRegenerate = () => {
    if (regenerateRef.current) {
      regenerateRef.current();
    }
  };

  const handleContinue = () => {
    if (continueRef.current) {
      continueRef.current();
    }
  };

  const handleOutputChange = (newOutput: string) => {
    setOutput(newOutput);
  };

  const handleSelectHistory = useCallback((item: HistoryItem) => {
    if (loadHistoryRef.current) {
      loadHistoryRef.current(item);
    }
    setOutput(item.output);
    setError(null);
    setIsHistoryOpen(false); // Close the sheet after selecting
  }, []);

  const refreshHistory = () => {
    setHistoryKey(prev => prev + 1);
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI 写作助手</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                选择 AI 模型，输入主题，生成高质量写作内容
              </p>
            </div>
            <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <History className="h-4 w-4" />
                  历史记录
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader className="px-2">
                  <SheetTitle>历史记录</SheetTitle>
                </SheetHeader>
                <div className="mt-6 h-[calc(100vh-8rem)] overflow-hidden px-2">
                  <HistoryPanel
                    key={historyKey}
                    onSelectHistory={handleSelectHistory}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Two Column Layout */}
      <main className="container mx-auto px-4 py-6 flex-1 overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-2 h-full">
          {/* Left Column - Input Form */}
          <div className="overflow-y-auto">
            <WritingForm
              output={output}
              setOutput={setOutput}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              error={error}
              setError={setError}
              regenerateRef={regenerateRef}
              continueRef={continueRef}
              loadHistoryRef={loadHistoryRef}
              onHistorySaved={refreshHistory}
            />
          </div>

          {/* Right Column - Output Panel */}
          <div className="overflow-hidden">
            <OutputPanel
              output={output}
              isLoading={isLoading}
              error={error}
              onRegenerate={handleRegenerate}
              onContinue={handleContinue}
              onOutputChange={handleOutputChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
