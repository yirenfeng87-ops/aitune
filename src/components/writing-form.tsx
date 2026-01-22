"use client";

import { useState, useEffect } from "react";
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

interface WritingFormProps {
  output: string;
  setOutput: (output: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

interface FormData {
  model: string;
  keyword: string;
  description: string;
  language: string;
  tone: string;
  role: string;
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

export function WritingForm({
  output,
  setOutput,
  isLoading,
  setIsLoading,
  error,
  setError,
}: WritingFormProps) {
  const [formData, setFormData] = useState<FormData>({
    model: "",
    keyword: "",
    description: "",
    language: "中文",
    tone: "正式",
    role: "资深写作助手",
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
    };
    localStorage.setItem("writingPreferences", JSON.stringify(prefs));
  }, [formData.model, formData.language, formData.tone, formData.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "生成失败");
      }

      if (data.success && data.data?.text) {
        setOutput(data.data.text);
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
  };

  const handleReset = () => {
    setFormData({
      model: formData.model, // Keep model selection
      keyword: "",
      description: "",
      language: formData.language, // Keep preferences
      tone: formData.tone,
      role: formData.role || "资深写作助手", // Reset to default if empty
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
