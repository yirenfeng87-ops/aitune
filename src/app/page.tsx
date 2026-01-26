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
import { History, Star } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import type { HistoryItem } from "@/lib/history";
import { getHistoryItemById } from "@/lib/history";

export default function Home() {
  const [output, setOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"history" | "favorites">("history");
  const [keyword, setKeyword] = useState<string>("");
  const [lastHistoryItem, setLastHistoryItem] = useState<HistoryItem | null>(null);
  const regenerateRef = useRef<(() => void) | null>(null);
  const continueRef = useRef<(() => void) | null>(null);
  const loadHistoryRef = useRef<((item: HistoryItem) => void) | null>(null);
  const [authed, setAuthed] = useState<boolean>(false);
  const [loginUser, setLoginUser] = useState<string>("");
  const [loginPass, setLoginPass] = useState<string>("");


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
    setKeyword(item.keyword);
    setError(null);
    setIsSheetOpen(false); // Close the sheet after selecting
    setLastHistoryItem(item);
  }, []);

  const refreshHistory = () => {
    setHistoryKey(prev => prev + 1);
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {!authed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">登录</h2>
            <p className="text-xs text-muted-foreground mb-4">输入账号与密码，点击登录即可进入</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="login-user" className="text-sm">账号</label>
                <input
                  id="login-user"
                  className="w-full rounded border px-3 py-2 text-sm bg-background"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="请输入账号"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="login-pass" className="text-sm">密码</label>
                <input
                  id="login-pass"
                  type="password"
                  className="w-full rounded border px-3 py-2 text-sm bg-background"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="请输入密码"
                />
              </div>
              <button
                className="w-full rounded bg-primary text-primary-foreground text-sm py-2 mt-2"
                onClick={() => {
                  setAuthed(true);
                }}
              >
                登录
              </button>
            </div>
          </div>
        </div>
      )}
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
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className={`gap-2 ${
                      isSheetOpen && sheetMode === "history"
                        ? "bg-primary/10 text-primary border-primary/30"
                        : ""
                    }`}
                    onClick={() => {
                      setSheetMode("history");
                      setIsSheetOpen(true);
                    }}
                  >
                    <History className="h-4 w-4" />
                    历史记录
                  </Button>
                  <Button
                    variant="outline"
                    className={`gap-2 ${
                      isSheetOpen && sheetMode === "favorites"
                        ? "bg-yellow-100/20 text-yellow-600 border-yellow-500/40 dark:bg-yellow-300/10 dark:text-yellow-400 dark:border-yellow-300/30"
                        : ""
                    }`}
                    onClick={() => {
                      setSheetMode("favorites");
                      setIsSheetOpen(true);
                    }}
                  >
                    <Star className="h-4 w-4" />
                    收藏列表
                  </Button>
                </div>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader className="px-2">
                  <SheetTitle>{sheetMode === "favorites" ? "收藏列表" : "历史记录"}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 h-[calc(100vh-8rem)] overflow-hidden px-2">
                  <HistoryPanel
                    key={`${sheetMode}-${historyKey}`}
                    onSelectHistory={handleSelectHistory}
                    mode={sheetMode}
                    onChanged={(changedId) => {
                      // refresh list
                      refreshHistory();
                      // if current output corresponds to changed item, refresh its favorite state
                      if (changedId && lastHistoryItem && lastHistoryItem.id === changedId) {
                        const updated = getHistoryItemById(changedId);
                        if (updated) setLastHistoryItem(updated);
                      }
                    }}
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
              onHistorySaved={(item) => {
                setLastHistoryItem(item);
                refreshHistory();
              }}
              onKeywordChange={setKeyword}
            />
          </div>

          {/* Right Column - Output Panel */}
          <div className="overflow-hidden">
              <OutputPanel
              key={lastHistoryItem?.id || `out-${historyKey}`}
              output={output}
              isLoading={isLoading}
              error={error}
              onRegenerate={handleRegenerate}
              onContinue={handleContinue}
              onOutputChange={handleOutputChange}
              keyword={keyword}
              lastHistoryItem={lastHistoryItem || undefined}
                onHistoryUpdated={(item) => {
                  if (item) setLastHistoryItem(item);
                  refreshHistory();
                }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
