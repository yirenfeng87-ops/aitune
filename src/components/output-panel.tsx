"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface OutputPanelProps {
  output: string;
  isLoading: boolean;
  error: string | null;
}

export function OutputPanel({ output, isLoading, error }: OutputPanelProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("内容已复制到剪贴板");
    } catch (err) {
      toast.error("复制失败，请重试");
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>生成结果</CardTitle>
          {output && !isLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              复制
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {/* Loading State */}
          {isLoading && (
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
                填写左侧表单后点击"生成内容"按钮
              </p>
            </div>
          )}

          {/* Output Content */}
          {!isLoading && !error && output && (
            <div className="rounded-lg bg-muted/50 p-6">
              <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:mt-6 prose-h1:mb-3 prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:text-[15px] prose-p:leading-[1.6] prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:leading-[1.6] prose-strong:font-semibold prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-background prose-pre:border prose-pre:text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {output}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
