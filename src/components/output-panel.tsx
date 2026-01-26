"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, AlertCircle, FileText, RefreshCw, Download, Plus, Edit, Save, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
 
import { toggleFavorite, findLatestByContent, addToHistory, getHistoryItemById } from "@/lib/history";
import type { HistoryItem } from "@/lib/history";
import { getChineseCharCount } from "@/lib/text";

interface OutputPanelProps {
  output: string;
  isLoading: boolean;
  error: string | null;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onOutputChange?: (newOutput: string) => void;
  keyword?: string;
  lastHistoryItem?: HistoryItem;
  onHistoryUpdated?: (item?: HistoryItem) => void;
}

export function OutputPanel({ output, isLoading, error, onRegenerate, onContinue, onOutputChange, keyword, lastHistoryItem, onHistoryUpdated }: OutputPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const isFavorited = useMemo(() => !!lastHistoryItem?.isFavorite, [lastHistoryItem?.isFavorite]);

  const cnCount = useMemo(() => getChineseCharCount(output || ""), [output]);

  const h1Count = useRef(0);
  const h2Count = useRef(0);
  const currentSection = useRef(0);
  const seenH2 = useRef<Set<string>>(new Set());
  useEffect(() => {
    h1Count.current = 0;
    h2Count.current = 0;
    currentSection.current = 0;
    seenH2.current = new Set();
  }, [output]);
  const stripLeadingOrder = (text: string) => {
    return text.replace(/^\s*(?:\d+(?:\.\d+)*|[IVXLCDM]+|[一二三四五六七八九十]+)[\.、\)\s]+/, "");
  };
  const toPlainText = (node: React.ReactNode): string => {
    if (node == null) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(toPlainText).join("");
    if (React.isValidElement(node)) {
      const el = node as React.ReactElement<{ children?: React.ReactNode }>;
      return toPlainText(el.props?.children);
    }
    return "";
  };

  const buildFileName = (ext: string) => {
    const base = (keyword?.trim() || "AI写作").replace(/[\\/:*?"<>|]/g, "");
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    const stamp = `${yyyy}-${mm}-${dd}_${HH}-${MM}`;
    return `${base}-${stamp}.${ext}`;
  };

  const handleEdit = () => {
    setEditedContent(output);
    setIsEditing(true);
  };

  // Sync heading counters on output change

  const handleSave = () => {
    if (onOutputChange) {
      onOutputChange(editedContent);
    }
    // Persist edited content as a new history version
    try {
      const base = lastHistoryItem || (keyword ? findLatestByContent(keyword, output) || undefined : undefined);
      if (base) {
        const saved = addToHistory({
          keyword: base.keyword,
          description: base.description,
          output: editedContent,
          model: base.model,
          language: base.language,
          tone: base.tone,
          role: base.role,
          length: base.length,
          template: base.template,
        });
        onHistoryUpdated?.(saved);
      } else {
        const saved = addToHistory({
          keyword: keyword || "",
          description: "",
          output: editedContent,
          model: "",
          language: "中文",
          tone: "正式",
          role: "资深写作助手",
          length: "medium",
          template: "default",
        });
        onHistoryUpdated?.(saved);
      }
    } catch {}
    setIsEditing(false);
    toast.success("已保存为新版本");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent("");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("内容已复制到剪贴板");
    } catch {
      toast.error("复制失败，请重试");
    }
  };

  const handleToggleFavorite = () => {
    if (!output) {
      toast.error("暂无内容可收藏");
      return;
    }
    let targetId: string | null = null;
    if (lastHistoryItem) {
      targetId = lastHistoryItem.id;
    } else {
      const matched = findLatestByContent(keyword || "", output);
      if (matched) {
        targetId = matched.id;
      }
    }
    if (!targetId) {
      toast.error("未找到可收藏的记录，请先生成内容");
      return;
    }
    try {
      toggleFavorite(targetId);
      const updated = getHistoryItemById(targetId);
      const nowFav = updated?.isFavorite ?? !isFavorited;
      onHistoryUpdated?.(updated || undefined);
      toast.success(nowFav ? "已收藏" : "已取消收藏");
    } catch {
      toast.error("操作失败，请重试");
    }
  };

  const handleExportTxt = () => {
    try {
      const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildFileName("txt");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("已导出为 TXT 文件");
    } catch {
      toast.error("导出失败，请重试");
    }
  };

 
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

 

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>生成结果</CardTitle>
              <span className="text-sm text-muted-foreground">- AI生成，内容仅供参考</span>
            </div>
            {output && (
              <div className="text-xs text-muted-foreground">
                中文字数：{cnCount}
              </div>
            )}
          </div>
          {output && !isLoading && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRegenerate}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重新生成
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onContinue}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                续写
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                复制
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleFavorite}
                className={`gap-2 ${
                  isFavorited
                    ? "text-yellow-600 border-yellow-500/40 bg-yellow-100/20 dark:text-yellow-400 dark:border-yellow-300/30 dark:bg-yellow-300/10"
                    : ""
                }`}
              >
                <Star
                  className="h-4 w-4"
                  fill={isFavorited ? "currentColor" : "none"}
                  strokeWidth={isFavorited ? 1.5 : 2}
                />
                {isFavorited ? "已收藏" : "收藏"}
              </Button>
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    保存
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="gap-2"
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  编辑
                </Button>
              )}
              {!isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      导出
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportTxt}>
                      导出为 TXT
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          {/* Loading State */}
          {isLoading && !output && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p className="text-sm">正在生成内容，请稍候...</p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertCircle className="h-8 w-8 mb-4" />
              <p className="text-sm font-medium mb-2">生成失败</p>
              <p className="text-xs text-muted-foreground text-center max-w-md">
                {error}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !output && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-8 w-8 mb-4" />
              <p className="text-sm">等待生成内容</p>
              <p className="text-xs mt-2 text-center max-w-md">
                填写左侧表单后点击&nbsp;&quot;生成内容&quot;&nbsp;按钮
              </p>
            </div>
          )}

          {/* Output Content */}
          {!error && output && (
            <div className="relative rounded-lg bg-muted/50 p-6">
              {isLoading && (
                <div className="pointer-events-none absolute inset-0 bg-background/40 flex items-start justify-end p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>流式生成中...</span>
                  </div>
                </div>
              )}
              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[500px] font-mono text-sm"
                  placeholder="编辑内容..."
                />
              ) : (
                <div ref={contentRef} className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:mt-6 prose-h1:mb-3 prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:text-[15px] prose-p:leading-[1.6] prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:leading-[1.6] prose-strong:font-semibold prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-background prose-pre:border prose-pre:text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: (props) => {
                        h1Count.current += 1;
                        h2Count.current = 0;
                        seenH2.current = new Set();
                        const raw = toPlainText(props.children);
                        const content = stripLeadingOrder(raw).trim();
                        let label = String(h1Count.current);
                        if (/^(标题候选)/.test(content)) label = "1";
                        else if (/^(内容大纲)/.test(content)) label = "2";
                        else if (/^(正文)/.test(content)) label = "3";
                        else if (/^(结尾总结|结尾总结或行动建议|行动建议|结语)/.test(content)) label = "4";
                        currentSection.current = parseInt(label, 10) || h1Count.current;
                        return (
                          <h1 {...props}>
                            <span className="text-foreground font-semibold mr-1">{label}. </span>
                            {content.length > 0 ? content : props.children}
                          </h1>
                        );
                      },
                      h2: (props) => {
                        const raw = toPlainText(props.children);
                        const m = raw.match(/^\s*(\d+(?:\.\d+)+)[\.、\)\s]+/);
                        let idx: number;
                        if (m) {
                          const parts = m[1].split(".");
                          idx = parseInt(parts[parts.length - 1], 10) || 1;
                        } else {
                          const key = raw.trim();
                          if (!seenH2.current.has(key)) {
                            seenH2.current.add(key);
                            h2Count.current += 1;
                          }
                          idx = h2Count.current;
                        }
                        const parent = currentSection.current || h1Count.current || 1;
                        const label = `${parent}.${idx}`;
                        const content = stripLeadingOrder(raw).trim();
                        return (
                          <h2 {...props}>
                            <span className="text-foreground font-semibold mr-1">{label} </span>
                            {content.length > 0 ? content : props.children}
                          </h2>
                        );
                      },
                      h3: (props) => {
                        const raw = toPlainText(props.children);
                        const content = stripLeadingOrder(raw).trim();
                        let label = String(h1Count.current + 1);
                        if (/^(标题候选)/.test(content)) label = "1";
                        else if (/^(内容大纲)/.test(content)) label = "2";
                        else if (/^(正文)/.test(content)) label = "3";
                        else if (/^(结尾总结|结尾总结或行动建议|行动建议|结语)/.test(content)) label = "4";
                        const num = parseInt(label, 10);
                        if (!Number.isNaN(num)) {
                          currentSection.current = num;
                        }
                        return <h3 {...props}>{props.children}</h3>;
                      },
                      h4: (props) => {
                        const raw = toPlainText(props.children);
                        const content = stripLeadingOrder(raw).trim();
                        let label = String(h1Count.current + 1);
                        if (/^(标题候选)/.test(content)) label = "1";
                        else if (/^(内容大纲)/.test(content)) label = "2";
                        else if (/^(正文)/.test(content)) label = "3";
                        else if (/^(结尾总结|结尾总结或行动建议|行动建议|结语)/.test(content)) label = "4";
                        const num = parseInt(label, 10);
                        if (!Number.isNaN(num)) {
                          currentSection.current = num;
                        }
                        return <h4 {...props}>{props.children}</h4>;
                      },
                      h5: (props) => {
                        const raw = toPlainText(props.children);
                        const content = stripLeadingOrder(raw).trim();
                        let label = String(h1Count.current + 1);
                        if (/^(标题候选)/.test(content)) label = "1";
                        else if (/^(内容大纲)/.test(content)) label = "2";
                        else if (/^(正文)/.test(content)) label = "3";
                        else if (/^(结尾总结|结尾总结或行动建议|行动建议|结语)/.test(content)) label = "4";
                        const num = parseInt(label, 10);
                        if (!Number.isNaN(num)) {
                          currentSection.current = num;
                        }
                        return <h5 {...props}>{props.children}</h5>;
                      },
                      h6: (props) => {
                        const raw = toPlainText(props.children);
                        const content = stripLeadingOrder(raw).trim();
                        let label = String(h1Count.current + 1);
                        if (/^(标题候选)/.test(content)) label = "1";
                        else if (/^(内容大纲)/.test(content)) label = "2";
                        else if (/^(正文)/.test(content)) label = "3";
                        else if (/^(结尾总结|结尾总结或行动建议|行动建议|结语)/.test(content)) label = "4";
                        const num = parseInt(label, 10);
                        if (!Number.isNaN(num)) {
                          currentSection.current = num;
                        }
                        return <h6 {...props}>{props.children}</h6>;
                      },
                      ol: (props) => (
                        <ol
                          className="list-decimal ml-6 space-y-1"
                          {...props}
                        />
                      ),
                      ul: (props) => (
                        <ul
                          className="list-disc ml-6 space-y-1"
                          {...props}
                        />
                      ),
                      table: (props) => (
                        <table
                          className="w-full border border-border border-collapse my-4 text-sm"
                          {...props}
                        />
                      ),
                      thead: (props) => (
                        <thead className="bg-muted/50" {...props} />
                      ),
                      tbody: (props) => <tbody {...props} />,
                      th: (props) => (
                        <th
                          className="border border-border px-3 py-2 text-left font-medium"
                          {...props}
                        />
                      ),
                      td: (props) => (
                        <td
                          className="border border-border px-3 py-2 align-top"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {output}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
