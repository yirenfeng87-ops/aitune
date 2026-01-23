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
import { addToHistory, type HistoryItem } from "@/lib/history";
import { TEMPLATES } from "@/lib/templates";

interface WritingFormProps {
  output: string;
  setOutput: (output: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  regenerateRef?: React.MutableRefObject<(() => void) | null>;
  continueRef?: React.MutableRefObject<(() => void) | null>;
  loadHistoryRef?: React.MutableRefObject<((item: any) => void) | null>;
  onHistorySaved?: () => void;
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
}

const MODELS = [
  { value: "deepseek/deepseek-r1-0528:free", label: "DeepSeek R1" },
  { value: "moonshotai/kimi-k2:free", label: "Kimi K2" },
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
  { value: "medium", label: "中（约600-1000字）" },
  { value: "long", label: "长（约1200-2000字）" },
];

export function WritingForm({
  output,
  setOutput,
  isLoading,
  setIsLoading,
  error,
  setError,
  regenerateRef,
  continueRef,
  loadHistoryRef,
  onHistorySaved,
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
    };
    localStorage.setItem("writingPreferences", JSON.stringify(prefs));
  }, [formData.model, formData.language, formData.tone, formData.role, formData.length]);

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
        const data = await response.json();
        throw new Error(data.error || "生成失败");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = ''; // Buffer to accumulate incomplete chunks
      let rafId: number | null = null;
      let pendingUpdate = false;

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
          console.log('[Stream] Stream completed');
          if (rafId !== null) cancelAnimationFrame(rafId);
          setOutput(fullText); // Final update
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        console.log('[Stream] Received chunk, buffer size:', buffer.length);

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            try {
              const json = JSON.parse(data);
              if (json.content) {
                fullText += json.content;
                scheduleUpdate(); // Throttled update
                console.log('[Stream] Updated output, total length:', fullText.length);
              }
            } catch (e) {
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
            const json = JSON.parse(data);
            if (json.content) {
              fullText += json.content;
              setOutput(fullText);
            }
          } catch (e) {
            console.error('Failed to parse final SSE data:', e);
          }
        }
      }

      // Save to history after completion
      if (fullText) {
        addToHistory({
          keyword: formData.keyword,
          description: formData.description,
          output: fullText,
          model: formData.model,
          language: formData.language,
          tone: formData.tone,
          role: formData.role,
          length: formData.length,
          template: formData.template,
        });

        // Notify parent that history was updated
        if (onHistorySaved) {
          onHistorySaved();
        }

        toast.success("内容生成成功！");
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
        throw new Error(data.error || "续写失败");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let newText = "";
      let buffer = ''; // Buffer to accumulate incomplete chunks

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
              const json = JSON.parse(data);
              if (json.content) {
                newText += json.content;
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
            const json = JSON.parse(data);
            if (json.content) {
              newText += json.content;
              setOutput(output + "\n\n" + newText);
            }
          } catch (e) {
            console.error('Failed to parse final SSE data:', e);
          }
        }
      }

      if (newText) {
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
  }, [formData, output, setError, setIsLoading, setOutput]);

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
    });
    toast.info("已加载历史记录");
  }, []);

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
              onChange={(e) =>
                setFormData({ ...formData, keyword: e.target.value })
              }
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
