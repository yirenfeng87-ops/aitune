"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";

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
    <Card className="h-full">
      <CardHeader>
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
      <CardContent>
        <div className="min-h-[400px] lg:min-h-[600px]">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-[400px] lg:h-[600px] text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p className="text-sm">正在生成内容，请稍候...</p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-[400px] lg:h-[600px] text-destructive">
              <AlertCircle className="h-8 w-8 mb-4" />
              <p className="text-sm font-medium mb-2">生成失败</p>
              <p className="text-xs text-muted-foreground text-center max-w-md">
                {error}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !output && (
            <div className="flex flex-col items-center justify-center h-[400px] lg:h-[600px] text-muted-foreground">
              <FileText className="h-8 w-8 mb-4" />
              <p className="text-sm">等待生成内容</p>
              <p className="text-xs mt-2 text-center max-w-md">
                填写左侧表单后点击"生成内容"按钮
              </p>
            </div>
          )}

          {/* Output Content */}
          {!isLoading && !error && output && (
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-6 text-sm leading-relaxed">
                {output}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
