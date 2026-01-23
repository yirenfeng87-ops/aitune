"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, AlertCircle, FileText, RefreshCw, Download, Plus, Edit, Save } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { jsPDF } from "jspdf";

interface OutputPanelProps {
  output: string;
  isLoading: boolean;
  error: string | null;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onOutputChange?: (newOutput: string) => void;
}

export function OutputPanel({ output, isLoading, error, onRegenerate, onContinue, onOutputChange }: OutputPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const handleEdit = () => {
    setEditedContent(output);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onOutputChange) {
      onOutputChange(editedContent);
    }
    setIsEditing(false);
    toast.success("内容已保存");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent("");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("内容已复制到剪贴板");
    } catch (err) {
      toast.error("复制失败，请重试");
    }
  };

  const handleExportTxt = () => {
    try {
      const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AI写作_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("已导出为 TXT 文件");
    } catch (err) {
      toast.error("导出失败，请重试");
    }
  };

  const handleExportMarkdown = () => {
    try {
      const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AI写作_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("已导出为 Markdown 文件");
    } catch (err) {
      toast.error("导出失败，请重试");
    }
  };

  const handleExportPdf = async () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Set font size and line height
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      const lineHeight = 7;
      let yPosition = margin;

      // Add title
      doc.setFontSize(16);
      const title = "AI 写作助手 - 生成内容";
      doc.text(title, margin, yPosition);
      yPosition += lineHeight * 2;

      // Add date
      doc.setFontSize(10);
      const date = new Date().toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(date, margin, yPosition);
      yPosition += lineHeight * 2;

      // Add content
      doc.setFontSize(12);

      // Split content into lines that fit the page width
      // Remove markdown formatting for PDF
      const cleanContent = output
        .replace(/#{1,6}\s/g, "") // Remove markdown headers
        .replace(/\*\*(.+?)\*\*/g, "$1") // Remove bold
        .replace(/\*(.+?)\*/g, "$1") // Remove italic
        .replace(/`(.+?)`/g, "$1"); // Remove code

      const lines = doc.splitTextToSize(cleanContent, maxWidth);

      // Add lines with page break handling
      for (let i = 0; i < lines.length; i++) {
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(lines[i], margin, yPosition);
        yPosition += lineHeight;
      }

      // Save the PDF
      const fileName = `AI写作_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.pdf`;
      doc.save(fileName);
      toast.success("已导出为 PDF 文件");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("PDF 导出失败，请重试");
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex flex-col gap-3">
          <CardTitle>生成结果</CardTitle>
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
                  <DropdownMenuItem onClick={handleExportMarkdown}>
                    导出为 Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPdf}>
                    导出为 PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[500px] font-mono text-sm"
                  placeholder="编辑内容..."
                />
              ) : (
                <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:mt-6 prose-h1:mb-3 prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:text-[15px] prose-p:leading-[1.6] prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:leading-[1.6] prose-strong:font-semibold prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-background prose-pre:border prose-pre:text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
