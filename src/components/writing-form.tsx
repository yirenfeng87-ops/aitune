"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { addToHistory, updateHistoryItem, findLatestByContent, type HistoryItem } from "@/lib/history";
import { TEMPLATES } from "@/lib/templates";
import { getCharCount } from "@/lib/text";

interface WritingFormProps {
  output: string;
  setOutput: (output: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  regenerateRef?: React.MutableRefObject<(() => void) | null>;
  continueRef?: React.MutableRefObject<(() => void) | null>;
  loadHistoryRef?: React.MutableRefObject<((item: HistoryItem) => void) | null>;
  onHistorySaved?: (item: HistoryItem) => void;
  onKeywordChange?: (keyword: string) => void;
}

interface FormData {
  model: string;
  keyword: string;
  description: string;
  language: string;
  tone: string;
  role: string;
  length: string;
  template: string;
  autoComplete: boolean;
}

const MODELS = [
  { value: "moonshotai/kimi-k2:free", label: "Kimi K2（free）" },
  { value: "deepseek/deepseek-r1-0528:free", label: "DeepSeek R1-0528（free）" },
  { value: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3 0324（free）" },
];

const LANGUAGES = [
  { value: "中文", label: "中文" },
  { value: "English", label: "English" },
  { value: "日本語", label: "日本語" },
];

const TONES = [
  { value: "正式", label: "正式" },
  { value: "轻松", label: "轻松" },
  { value: "专业", label: "专业" },
  { value: "说服型", label: "说服型" },
];

const LENGTHS = [
  { value: "short", label: "短（约300-500字）" },
  { value: "medium", label: "中（约800-1200字）" },
  { value: "long", label: "长（约1500-2200字）" },
];

export function WritingForm({
  output,
  setOutput,
  isLoading,
  setIsLoading,
  setError,
  regenerateRef,
  continueRef,
  loadHistoryRef,
  onHistorySaved,
  onKeywordChange,
}: WritingFormProps) {
  const [formData, setFormData] = useState<FormData>({
    model: "",
    keyword: "",
    description: "",
    language: "中文",
    tone: "正式",
    role: "资深写作助手",
    length: "medium",
    template: "default",
    autoComplete: true,
  });

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPrefs = localStorage.getItem("writingPreferences");
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        setFormData((prev) => ({
          ...prev,
          model: prefs.model || prev.model,
          language: prefs.language || prev.language,
          tone: prefs.tone || prev.tone,
          role: prefs.role || prev.role,
          length: prefs.length || prev.length,
        }));
      } catch (e) {
        console.error("Failed to load preferences:", e);
      }
    }
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    const prefs = {
      model: formData.model,
      language: formData.language,
      tone: formData.tone,
      role: formData.role,
      length: formData.length,
      autoComplete: formData.autoComplete,
    };
    localStorage.setItem("writingPreferences", JSON.stringify(prefs));
  }, [formData.model, formData.language, formData.tone, formData.role, formData.length, formData.autoComplete]);

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        template: templateId,
        language: template.config.language,
        tone: template.config.tone,
        role: template.config.role,
        length: template.config.length,
        autoComplete: prev.autoComplete,
      }));
      toast.info(`已应用 ${template.name} 模板`);
    }
  };

  const handleGenerate = useCallback(async () => {
    setError(null);

    // Validation
    if (!formData.model) {
      toast.error("请选择模型");
      return;
    }
    if (!formData.keyword || formData.keyword.length < 2 || formData.keyword.length > 50) {
      toast.error("主题关键词长度应在 2-50 字之间");
      return;
    }
    if (!formData.description || formData.description.length < 10 || formData.description.length > 1000) {
      toast.error("主题描述长度应在 10-1000 字之间");
      return;
    }

    setIsLoading(true);
    setOutput("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        try {
          const resp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...formData, stream: false }),
          });
          if (!resp.ok) {
            const data = await resp.json();
            const ft = data?.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
            throw new Error(`生成失败（${ft}）：${data.error || "请重试"}`);
          }
          const data = await resp.json();
          const content = data?.content;
          if (content) {
            setIsLoading(false);
            setOutput(content);
          } else {
            throw new Error("生成失败，请重试");
          }
          return;
        } catch {
          const data: { error?: string; failureType?: string } | null = await response.json().catch(() => null);
          const ft = data?.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
          throw new Error(`生成失败（${ft}）：${data?.error || "请重试"}`);
        }
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = ''; // Buffer to accumulate incomplete chunks
      let rafId: number | null = null;
      let pendingUpdate = false;
      let firstChunkReceived = false;
      let showedFallbackNotice = false;

      if (!reader) {
        throw new Error("无法读取响应流");
      }

      // Throttled update using requestAnimationFrame
      const scheduleUpdate = () => {
        if (!pendingUpdate) {
          pendingUpdate = true;
          rafId = requestAnimationFrame(() => {
            setOutput(fullText);
            pendingUpdate = false;
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (rafId !== null) cancelAnimationFrame(rafId);
          setOutput(fullText);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const payloadLines = block
            .split("\n")
            .map(l => l.trim())
            .filter(l => l.startsWith("data: "))
            .map(l => l.slice(6));
          if (payloadLines.length === 0) {
            idx = buffer.indexOf("\n\n");
            continue;
          }
          const payload = payloadLines.join("");
          if (payload === "[DONE]") {
            idx = buffer.indexOf("\n\n");
            continue;
          }
          try {
            const raw = JSON.parse(payload) as unknown;
            const obj = raw as { content?: string; meta?: { source?: string; failureType?: string; status?: number } };
            const content = obj.content;
            const meta = obj.meta;
            if (!showedFallbackNotice && meta && meta.source === "local_fallback_stream") {
              const ftLabel = meta.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
              const statusText = meta.status ? `/${meta.status}` : "";
              toast.info(`当前为兜底内容（${ftLabel}${statusText}）`);
              showedFallbackNotice = true;
            }
            if (content) {
              fullText += content;
              if (!firstChunkReceived) {
                setIsLoading(false);
                firstChunkReceived = true;
              }
              scheduleUpdate();
            }
          } catch {}
          idx = buffer.indexOf("\n\n");
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const payloadLines = buffer
          .split("\n")
          .map(l => l.trim())
          .filter(l => l.startsWith("data: "))
          .map(l => l.slice(6));
        const payload = payloadLines.join("");
        if (payload && payload !== "[DONE]") {
          try {
            const json = JSON.parse(payload);
            const content = json.content;
            if (content) {
              fullText += content;
              if (!firstChunkReceived) {
                setIsLoading(false);
                firstChunkReceived = true;
              }
              setOutput(fullText);
            }
          } catch {}
        }
      }

      // Fallback to non-stream if empty
      if (!fullText || fullText.trim().length === 0) {
        try {
          const resp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...formData, stream: false }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.content) {
              fullText = data.content;
              setOutput(fullText);
              setIsLoading(false);
              const src = resp.headers.get("X-Source");
              const ft = resp.headers.get("X-Failure-Type") || data?.meta?.failureType;
              if (src === "local_fallback" || data?.meta?.source === "local_fallback") {
                const ftLabel = ft === "API" ? "上游服务/限流" : "本地参数/配置";
                toast.info(`当前为兜底内容（${ftLabel}）`);
              }
            }
          }
        } catch {}
      }

      // Auto-completion detection
      const isLikelyIncomplete = (text: string) => {
        const isFallback =
          text.includes("提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。") ||
          text.includes("Notice: This is locally generated fallback content") ||
          text.includes("注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。");
        if (isFallback) return false;
        const hasBody = /正文/.test(text);
        const hasConclusion = /(结尾总结|总结|行动建议)/.test(text);
        const looksTruncated = /未完|待续|\.{3}$|…$/.test(text);
        const count = getCharCount(text);
        const ranges: Record<string, { min: number; max: number }> = {
          short: { min: 300, max: 500 },
          medium: { min: 800, max: 1200 },
          long: { min: 1500, max: 2200 },
        };
        const range = ranges[formData.length] ?? ranges.medium;
        return (!hasBody || !hasConclusion || looksTruncated || count < range.min);
      };

      let finalText = fullText;
      if (formData.autoComplete && isLikelyIncomplete(fullText)) {
        try {
          setIsLoading(true);
          let newText = "";
          const response2 = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...formData,
              isContinue: true,
              previousContent: fullText,
            }),
          });
          if (!response2.ok) {
            try {
              const resp2 = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...formData,
                  isContinue: true,
                  previousContent: fullText,
                  stream: false,
                }),
              });
              if (!resp2.ok) {
                const data2 = await resp2.json();
                const ft2 = data2?.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
                throw new Error(`自动续写失败（${ft2}）：${data2.error || "请重试"}`);
              }
              const data2 = await resp2.json();
              const content2 = data2?.content;
              if (content2) {
                setIsLoading(false);
                setOutput(fullText + "\n\n" + content2);
                newText = content2;
              } else {
                throw new Error("自动续写失败");
              }
              return;
            } catch {
              const data2: { error?: string; failureType?: string } | null = await response2.json().catch(() => null);
              const ft2 = data2?.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
              throw new Error(`自动续写失败（${ft2}）：${data2?.error || "请重试"}`);
            }
          }
          const reader2 = response2.body?.getReader();
          const decoder2 = new TextDecoder();
          let buffer2 = '';
          let firstChunkReceived2 = false;
          if (!reader2) {
            throw new Error("无法读取续写响应流");
          }
          while (true) {
            const { done, value } = await reader2.read();
            if (done) break;
            buffer2 += decoder2.decode(value, { stream: true });
            let idx2 = buffer2.indexOf("\n\n");
            while (idx2 !== -1) {
              const block2 = buffer2.slice(0, idx2);
              buffer2 = buffer2.slice(idx2 + 2);
              const payloadLines2 = block2
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.startsWith("data: "))
                .map(l => l.slice(6));
              if (payloadLines2.length === 0) {
                idx2 = buffer2.indexOf("\n\n");
                continue;
              }
              const payload2 = payloadLines2.join("");
              if (payload2 === "[DONE]") {
                idx2 = buffer2.indexOf("\n\n");
                continue;
              }
              try {
                const json = JSON.parse(payload2);
                const content2 = json.content;
                if (content2) {
                  newText += content2;
                  if (!firstChunkReceived2) {
                    setIsLoading(false);
                    firstChunkReceived2 = true;
                  }
                  setOutput(fullText + "\n\n" + newText);
                }
              } catch {}
              idx2 = buffer2.indexOf("\n\n");
            }
          }
          if (buffer2.trim()) {
            const payloadLines2 = buffer2
              .split("\n")
              .map(l => l.trim())
              .filter(l => l.startsWith("data: "))
              .map(l => l.slice(6));
            const payload2 = payloadLines2.join("");
            if (payload2 && payload2 !== "[DONE]") {
              try {
                const json = JSON.parse(payload2);
                const content2 = json.content;
                if (content2) {
                  newText += content2;
                  setOutput(fullText + "\n\n" + newText);
                }
              } catch {}
            }
          }
          if (newText) {
            finalText = fullText + "\n\n" + newText;
            toast.success("已自动续写补全");
          }
        } catch (e) {
          console.error("Auto-complete error:", e);
        } finally {
          setIsLoading(false);
        }
      }

      // Deduplicate fallback content if repeated
      if (finalText) {
        const markers = [
          "提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。",
          "Notice: This is locally generated fallback content",
          "注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。",
        ];
        for (const m of markers) {
          const first = finalText.indexOf(m);
          if (first !== -1) {
            const second = finalText.indexOf(m, first + m.length);
            if (second !== -1) {
              finalText = finalText.slice(0, second).trim();
              break;
            }
          }
        }
      }

      // Save to history after completion (finalText)
      if (finalText) {
        const saved = addToHistory({
          keyword: formData.keyword,
          description: formData.description,
          output: finalText,
          model: formData.model,
          language: formData.language,
          tone: formData.tone,
          role: formData.role,
          length: formData.length,
          template: formData.template,
        });

        // Notify parent that history was updated
        if (onHistorySaved) {
          onHistorySaved(saved);
        }

        const fallbackMarkers = [
          "提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。",
          "Notice: This is locally generated fallback content",
          "注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。",
        ];
        const isFallbackFinal = fallbackMarkers.some(m => finalText.includes(m));
        if (!isFallbackFinal) {
          toast.success("内容生成成功！");
        }
      } else {
        throw new Error("未返回有效内容");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败，请重试";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [formData, setError, setIsLoading, setOutput, onHistorySaved]);

  // Handle continue writing
  const handleContinue = useCallback(async () => {
    if (!output) {
      toast.error("没有可续写的内容");
      return;
    }
    const isFallback =
      output.includes("提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。") ||
      output.includes("Notice: This is locally generated fallback content") ||
      output.includes("注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。");
    if (isFallback) {
      toast.error("当前为兜底内容，暂不支持续写");
      return;
    }

    if (!formData.model) {
      toast.error("请选择模型");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          isContinue: true,
          previousContent: output,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        const ft = data?.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
        throw new Error(`续写失败（${ft}）：${data.error || "请重试"}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let newText = "";
      let buffer = ''; // Buffer to accumulate incomplete chunks
      let firstChunkReceived = false;
      let showedFallbackNotice = false;

      if (!reader) {
        throw new Error("无法读取响应流");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Split by newlines but keep incomplete lines in buffer
        const lines = buffer.split('\n');

        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || '';

        // Process complete lines
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            try {
              const raw = JSON.parse(data) as unknown;
              const obj = raw as { content?: string; meta?: { source?: string; failureType?: string } };
              const meta = obj.meta;
              if (!showedFallbackNotice && meta && meta.source === "local_fallback_stream") {
                const ftLabel = meta.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
                toast.info(`当前为兜底内容（${ftLabel}）`);
                showedFallbackNotice = true;
              }
              if (obj.content) {
                newText += obj.content;
                if (!firstChunkReceived) {
                  setIsLoading(false);
                  firstChunkReceived = true;
                }
                setOutput(output + "\n\n" + newText);
              }
            } catch (e) {
              // Skip invalid JSON (should be rare now with buffering)
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const trimmedLine = buffer.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);
            try {
              const raw = JSON.parse(data) as unknown;
              const obj = raw as { content?: string; meta?: { source?: string; failureType?: string } };
              if (obj.content) {
                newText += obj.content;
              if (!firstChunkReceived) {
                setIsLoading(false);
                firstChunkReceived = true;
              }
              setOutput(output + "\n\n" + newText);
            }
          } catch (e) {
            console.error('Failed to parse final SSE data:', e);
          }
        }
      }

      // Fallback to non-stream continue if empty
      if (!newText || newText.trim().length === 0) {
        try {
          const resp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...formData,
              isContinue: true,
              previousContent: output,
              stream: false,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.content) {
              newText = data.content;
              setOutput(output + "\n\n" + newText);
              setIsLoading(false);
              const src = resp.headers.get("X-Source");
              const ft = resp.headers.get("X-Failure-Type") || data?.meta?.failureType;
              if (src === "local_fallback" || data?.meta?.source === "local_fallback") {
                const ftLabel = ft === "API" ? "上游服务/限流" : "本地参数/配置";
                toast.info(`当前为兜底内容（${ftLabel}）`);
              }
            }
          } else {
            const data = await resp.json().catch(() => ({}));
            const ft = data?.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
            throw new Error(`续写失败（${ft}）：${data?.error || "请重试"}`);
          }
        } catch {}
      }

      if (newText) {
        // Update the latest matching history item by appending continue text
        try {
          const base = findLatestByContent(formData.keyword, output);
          const finalOut = output + "\n\n" + newText;
          if (base) {
            const updated = updateHistoryItem(base.id, { output: finalOut });
            if (updated && onHistorySaved) onHistorySaved(updated);
          } else {
            const saved = addToHistory({
              keyword: formData.keyword,
              description: formData.description,
              output: finalOut,
              model: formData.model,
              language: formData.language,
              tone: formData.tone,
              role: formData.role,
              length: formData.length,
              template: formData.template,
            });
            if (onHistorySaved) onHistorySaved(saved);
          }
        } catch (e) {
          console.error("Failed to persist continue content:", e);
        }
        toast.success("续写成功！");
      } else {
        throw new Error("未返回有效内容");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "续写失败，请重试";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [formData, output, setError, setIsLoading, setOutput, onHistorySaved]);

  // Expose handleGenerate function to parent via ref
  useEffect(() => {
    if (regenerateRef) {
      regenerateRef.current = handleGenerate;
    }
  }, [regenerateRef, handleGenerate]);

  // Expose handleContinue function to parent via ref
  useEffect(() => {
    if (continueRef) {
      continueRef.current = handleContinue;
    }
  }, [continueRef, handleContinue]);

  // Function to load a history item into the form
  const loadHistoryItem = useCallback((item: HistoryItem) => {
    setFormData({
      model: item.model,
      keyword: item.keyword,
      description: item.description,
      language: item.language,
      tone: item.tone,
      role: item.role,
      length: item.length,
      template: "default", // Reset to default template when loading history
      autoComplete: formData.autoComplete,
    });
    if (onKeywordChange) onKeywordChange(item.keyword);
    toast.info("已加载历史记录");
  }, [onKeywordChange, formData.autoComplete]);

  // Expose loadHistoryItem function to parent via ref
  useEffect(() => {
    if (loadHistoryRef) {
      loadHistoryRef.current = loadHistoryItem;
    }
  }, [loadHistoryRef, loadHistoryItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleGenerate();
  };

  const handleReset = () => {
    setFormData({
      model: formData.model, // Keep model selection
      keyword: "",
      description: "",
      language: formData.language, // Keep preferences
      tone: formData.tone,
      role: formData.role || "资深写作助手", // Reset to default if empty
      length: formData.length, // Keep length preference
      template: formData.template, // Keep template selection
      autoComplete: formData.autoComplete,
    });
    setOutput("");
    setError(null);
    toast.info("表单已重置");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>输入设置</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">
              AI 模型 <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.model}
              onValueChange={(value) =>
                setFormData({ ...formData, model: value })
              }
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="选择 AI 模型" />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">场景模板</Label>
            <Select
              value={formData.template}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger id="template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <span className="flex items-center gap-2">
                      <span>{template.icon}</span>
                      <span>{template.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TEMPLATES.find(t => t.id === formData.template)?.description}
            </p>
          </div>

          {/* Keyword Input */}
          <div className="space-y-2">
            <Label htmlFor="keyword">
              主题关键词 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="keyword"
              placeholder="例：人工智能、产品设计..."
              value={formData.keyword}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, keyword: value });
                if (onKeywordChange) onKeywordChange(value);
              }}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {formData.keyword.length}/50 字
            </p>
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <Label htmlFor="description">
              主题描述 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="详细描述您想要生成的内容主题和要求..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={6}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/1000 字
            </p>
          </div>

          <Separator />

          {/* Advanced Settings - Accordion */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced">
              <AccordionTrigger>高级设置</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {/* Language */}
                <div className="space-y-2">
                  <Label htmlFor="language">输出语言</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value) =>
                      setFormData({ ...formData, language: value })
                    }
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tone */}
                <div className="space-y-2">
                  <Label htmlFor="tone">语气风格</Label>
                  <Select
                    value={formData.tone}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tone: value })
                    }
                  >
                    <SelectTrigger id="tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((tone) => (
                        <SelectItem key={tone.value} value={tone.value}>
                          {tone.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label htmlFor="role">角色设定</Label>
                  <Input
                    id="role"
                    placeholder="例：资深文案、产品经理、营销专家"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    maxLength={20}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    自定义 AI 的角色身份
                  </p>
                </div>

                {/* Length */}
                <div className="space-y-2">
                  <Label htmlFor="length">内容长度</Label>
                  <Select
                    value={formData.length}
                    onValueChange={(value) =>
                      setFormData({ ...formData, length: value })
                    }
                  >
                    <SelectTrigger id="length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LENGTHS.map((length) => (
                        <SelectItem key={length.value} value={length.value}>
                          {length.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Auto-complete */}
                <div className="space-y-2">
                  <Label htmlFor="autoComplete">自动续写补全</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="autoComplete"
                      type="checkbox"
                      checked={formData.autoComplete}
                      onChange={(e) =>
                        setFormData({ ...formData, autoComplete: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">
                      生成后自动检测未完成并续写合并，保证完整性
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "生成中..." : "生成内容"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isLoading}
            >
              重置
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
