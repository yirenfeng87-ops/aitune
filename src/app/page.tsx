"use client";

import { WritingForm } from "@/components/writing-form";
import { OutputPanel } from "@/components/output-panel";
import { useState } from "react";

export default function Home() {
  const [output, setOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold tracking-tight">AI 写作助手</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选择 AI 模型，输入主题，生成高质量写作内容
          </p>
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
            />
          </div>

          {/* Right Column - Output Panel */}
          <div className="overflow-hidden">
            <OutputPanel
              output={output}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
