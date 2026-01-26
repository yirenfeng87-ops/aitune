"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  { value: "deepseek/deepseek-r1-0528:free", label: "DeepSeek R1-0528（free）" },
  { value: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3 0324（free）" },
  { value: "moonshotai/kimi-k2:free", label: "Kimi K2（free）" },
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
    model: "deepseek/deepseek-r1-0528:free",
    keyword: "",
    description: "",
    language: "中文",
    tone: "正式",
    role: "资深写作助手",
    length: "medium",
    template: "default",
    autoComplete: true,
  });

  const fallbackToastClock = useRef<{ lastAt: number | null; lastMsg: string | null }>({ lastAt: null, lastMsg: null });
  const showFallbackToast = (ftLabel: string, statusText?: string) => {
    const now = Date.now();
    const msg = `当前为兜底内容（${ftLabel}${statusText || ""}）`;
    const lastAt = fallbackToastClock.current.lastAt;
    const lastMsg = fallbackToastClock.current.lastMsg;
    if (lastAt && lastMsg === msg && now - lastAt < 4000) return;
    toast.info(msg);
    fallbackToastClock.current.lastAt = now;
    fallbackToastClock.current.lastMsg = msg;
  };

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

  const normalizeTitleCandidates = (text: string, keyword: string, language: string) => {
    const lines = text.split(/\r?\n/);
    let inSection = false;
    let idxCounter = 1;
    const headerPatterns = [/标题候选/, /Title Candidates/i, /タイトル候補/];
    const stopPatterns = [/内容大纲/, /Outline/i, /アウトライン/, /正文/, /Body/i, /本文/, /结尾总结|行动建议/, /Conclusion/i, /結論/];
    const placeholder = (idx: number) => {
      if (language === "English") {
        if (idx === 1) return `${keyword}: Key Points and Practice`;
        if (idx === 2) return `${keyword} Strategy Guide`;
        return `${keyword} Case Notes`;
      }
      if (language === "日本語") {
        if (idx === 1) return `${keyword}の要点と実践`;
        if (idx === 2) return `${keyword}戦略ガイド`;
        return `${keyword}ケースメモ`;
      }
      if (idx === 1) return `${keyword}：核心要点与实践`;
      if (idx === 2) return `${keyword}应用攻略`;
      return `${keyword}策略笔记`;
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inSection && headerPatterns.some(p => p.test(line))) {
        inSection = true;
        idxCounter = 1;
        continue;
      }
      if (inSection) {
        const inlineItems = Array.from(line.matchAll(/(?:^|\s)(\d+)\.\s*(.*?)(?=(?:\s+\d+\.\s)|$)/g));
        if (inlineItems.length > 1) {
          idxCounter = 1;
          lines[i] = inlineItems
            .map((m, k) => {
              const content = (m[2] || "").trim().replace(/^\(\d+\)\s*/, "");
              const n = Math.min(k + 1, 3);
              return `## ${content || placeholder(n)}`;
            })
            .join("\n");
          continue;
        }
        if (stopPatterns.some(p => p.test(line)) || /^\s*\d+\.\s*(内容大纲|Outline|アウトライン|正文|Body|本文|结尾总结|行动建议|Conclusion|結論)/.test(line)) {
          inSection = false;
          break;
        }
        const mHier = line.match(/^\s*1\.\d+\s+(.*)$/);
        if (mHier) {
          const content = (mHier[1] || "").trim().replace(/^\(\d+\)\s*/, "");
          lines[i] = `## ${content || placeholder(idxCounter)}`;
          idxCounter += 1;
          continue;
        }
        const mOld = line.match(/^\s*(\d+)\.\s*(.*)$/);
        if (mOld) {
          const idx = parseInt(mOld[1], 10);
          const content = mOld[2].trim();
          lines[i] = `## ${content || placeholder(idx)}`;
          idxCounter = Math.max(idxCounter, idx + 1);
          continue;
        }
        const content = line.trim();
        if (content.length > 0 && !/^\s*#\s*/.test(content)) {
          const cur = Math.min(idxCounter, 3);
          lines[i] = `## ${content}`;
          idxCounter = cur + 1;
        }
      }
    }
    return lines.join("\n");
  };

  const normalizeOutline = (text: string) => {
    const trimOutlineText = (s: string) => {
      const i = s.search(/[。\.]/);
      return i !== -1 ? s.slice(0, i).trim() : s.trim();
    };
    const fixDanglingTail = (s: string) => {
      const r = s.replace(/[的之与和或及等、：:]\s*$/, "");
      return r.trim().length > 0 ? r.trim() : s.trim();
    };
    const lines = text.split(/\r?\n/);
    let inSection = false;
    const headerPatterns = [/内容大纲/, /Outline/i, /アウトライン/];
    const stopPatterns = [/正文/, /Body/i, /本文/, /结尾总结|行动建议/, /Conclusion/i, /結論/];
    let seq = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inSection && headerPatterns.some(p => p.test(line))) {
        inSection = true;
        seq = 0;
        continue;
      }
      if (inSection) {
        if (stopPatterns.some(p => p.test(line)) || /^\s*\d+\.\s*(正文|Body|本文|结尾总结|行动建议|Conclusion|結論)/.test(line)) {
          inSection = false;
          break;
        }
        const inlineItems = Array.from(line.matchAll(/(?:^|\s)(\d+)\.\s*(.*?)(?=(?:\s+\d+\.\s)|$)/g));
        if (inlineItems.length > 1) {
          seq = 0;
          lines[i] = inlineItems
            .map((m) => {
              const content = (m[2] || "").trim().replace(/^\(\d+\)\s*/, "");
              seq += 1;
              return `## ${fixDanglingTail(trimOutlineText(content))}`;
            })
            .join("\n");
          continue;
        }
        const mHier = line.match(/^\s*2\.\d+\s+(.*)$/);
        if (mHier) {
          const content = (mHier[1] || "").trim().replace(/^\(\d+\)\s*/, "");
          lines[i] = `## ${fixDanglingTail(trimOutlineText(content))}`;
          continue;
        }
        const mOld = line.match(/^\s*(\d+)\.\s*(.*)$/);
        if (mOld) {
          const idx = parseInt(mOld[1], 10);
          const content = fixDanglingTail(trimOutlineText(mOld[2]));
          lines[i] = `## ${content}`;
          seq = Math.max(seq, idx);
          continue;
        }
        const content = line.trim();
        if (content.length > 0 && !/^\s*#\s*/.test(content)) {
          seq += 1;
          lines[i] = `## ${fixDanglingTail(trimOutlineText(content))}`;
        }
      }
    }
    return lines.join("\n");
  };

  const normalizeTopSections = (text: string) => {
    const lines = text.split(/\r?\n/);
    const normLine = (line: string) => {
      const stripped = line.replace(/^\s*#{1,6}\s*/, "").trim();
      let idx: number | null = null;
      let title = "";
      const m1 = stripped.match(/^(\d+)\s*[\.、]?\s*(.+)$/);
      if (m1) {
        idx = parseInt(m1[1], 10);
        title = (m1[2] || "").trim().replace(/\s*[（(]+$/, "");
      } else {
        title = stripped.replace(/\s*[（(]+$/, "");
      }
      const isTop =
        /^(标题候选|Title Candidates|タイトル候補|内容大纲|Outline|アウトライン|正文|Body|本文|结尾|结语|结尾总结|结尾总结或行动建议|行动建议|Conclusion|結論)/.test(title);
      if (!isTop) return line;
      let fixedIdx = idx;
      if (fixedIdx == null) {
        if (/^(标题候选|Title Candidates|タイトル候補)/.test(title)) fixedIdx = 1;
        else if (/^(内容大纲|Outline|アウトライン)/.test(title)) fixedIdx = 2;
        else if (/^(正文|Body|本文)/.test(title)) fixedIdx = 3;
        else fixedIdx = 4;
      }
      return `# ${fixedIdx}. ${title}`;
    };
    for (let i = 0; i < lines.length; i++) {
      lines[i] = normLine(lines[i]);
    }
    const idx1 = lines.findIndex(l => /^#\s*1\.\s+/.test(l));
    const idx2 = lines.findIndex(l => /^#\s*2\.\s+/.test(l));
    const idx3 = lines.findIndex(l => /^#\s*3\.\s+/.test(l));
    const idx4 = lines.findIndex(l => /^#\s*4\.\s+/.test(l));
    if (idx1 !== -1 && idx2 !== -1 && idx3 !== -1 && idx4 !== -1) {
      const nextTopAfter4Rel = lines.slice(idx4 + 1).findIndex(l => /^#\s*\d+\.\s+/.test(l));
      const endAfter4Abs = nextTopAfter4Rel !== -1 ? idx4 + 1 + nextTopAfter4Rel : lines.length;
      const seg = (start: number, end: number) => lines.slice(start, end);
      const s1 = seg(idx1, idx2);
      const s2 = seg(idx2, idx3);
      const s3 = seg(idx3, idx4);
      const s4 = seg(idx4, endAfter4Abs);
      return [...s1, ...s2, ...s3, ...s4].join("\n");
    }
    return lines.join("\n");
  };

  const clampOutputToLength = (text: string, lengthKey: string, language: string, allowOverflow: boolean) => {
    if (allowOverflow) return text;
    const ranges: Record<string, { min: number; max: number }> = {
      short: { min: 300, max: 500 },
      medium: { min: 800, max: 1200 },
      long: { min: 1500, max: 2200 },
    };
    const range = ranges[lengthKey] ?? ranges.medium;
    const max = range.max;
    const total = getCharCount(text);
    if (total <= max) return text;
    const lines = text.split(/\r?\n/);
    const idxBodyStart = lines.findIndex(l =>
      /^#\s*3\.\s+(正文|Body|本文)/.test(l)
    );
    if (idxBodyStart === -1) {
      // No explicit body section, fallback: hard clamp by characters
      let acc = "";
      for (const ch of text) {
        acc += ch;
        if (getCharCount(acc) >= max) break;
      }
      return acc.trim();
    }
    const idxNextTop = lines.slice(idxBodyStart + 1).findIndex(l => /^#\s*4\.\s+/.test(l));
    const bodyEnd = idxNextTop !== -1 ? idxBodyStart + 1 + idxNextTop : lines.length;
    const prefix = lines.slice(0, idxBodyStart + 1).join("\n");
    const body = lines.slice(idxBodyStart + 1, bodyEnd).join("\n");
    const suffix = lines.slice(bodyEnd).join("\n");
    const fixedCount = getCharCount(`${prefix}\n${suffix}`);
    const budget = max - fixedCount;
    if (budget <= 0) {
      // Keep headings and minimal body
      return `${prefix}\n\n${suffix}`.trim();
    }
    const segments = body
      .split(/(?<=。|！|!|？|\?|；|;|\n{2,})/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    let chosen = "";
    for (let i = 0; i < segments.length; i++) {
      const tentative = (chosen ? `${chosen}` : "") + (chosen ? "" : "") + segments[i];
      const nextCount = getCharCount(`${prefix}\n${tentative}\n${suffix}`);
      if (nextCount <= max) {
        chosen = tentative;
      } else {
        // Try partial of this segment
        let partial = "";
        for (const ch of segments[i]) {
          const tryText = `${prefix}\n${chosen}${ch}\n${suffix}`;
          if (getCharCount(tryText) > max) break;
          partial += ch;
        }
        chosen = chosen + partial;
        break;
      }
    }
    const result = `${prefix}\n${chosen}\n${suffix}`.trim();
    return result;
  };

  const hasFallbackMarker = (text: string) => {
    return (
      text.includes("提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。") ||
      text.includes("Notice: This is locally generated fallback content") ||
      text.includes("注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。")
    );
  };

  const enforceFallbackShape = (text: string) => {
    const markers = [
      "提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。",
      "Notice: This is locally generated fallback content",
      "注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。",
    ];
    const lines = text.split(/\r?\n/);
    const markerIdx = lines.findIndex(l => markers.some(m => l.includes(m)));
    const langDetector = (s: string) => {
      if (/(Title Candidates|Outline|Body|Conclusion)/i.test(s)) return "en";
      if (/(タイトル候補|アウトライン|本文|結論)/.test(s)) return "jp";
      return "cn";
    };
    const lang = langDetector(text);
    const markerText =
      lang === "en"
        ? "Notice: This is locally generated fallback content"
        : lang === "jp"
        ? "注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。"
        : "提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。";
    const findNextAbs = (n: number, startAbs: number) => {
      if (startAbs === -1) return -1;
      const rel = lines.slice(startAbs + 1).findIndex(l => new RegExp(`^#\\s*${n}\\.\\s+`).test(l));
      return rel !== -1 ? startAbs + 1 + rel : -1;
    };
    const idx1 = lines.findIndex(l => /^#\s*1\.\s+/.test(l));
    const idx2 = findNextAbs(2, idx1);
    const idx3 = findNextAbs(3, idx2);
    const idx4 = findNextAbs(4, idx3);
    if (idx1 === -1) return text;
    const nextTopAfter4Rel = idx4 !== -1 ? lines.slice(idx4 + 1).findIndex(l => /^#\s*\d+\.\s+/.test(l)) : -1;
    const endAfter4Abs = nextTopAfter4Rel !== -1 ? idx4 + 1 + nextTopAfter4Rel : lines.length;
    const seg = (start: number, end: number) => (start !== -1 ? lines.slice(start, end) : []);
    const s1 = seg(idx1, idx2 !== -1 ? idx2 : (idx4 !== -1 ? idx4 : endAfter4Abs));
    const s2 = seg(idx2, idx3 !== -1 ? idx3 : (idx4 !== -1 ? idx4 : endAfter4Abs));
    const s3 = seg(idx3, idx4 !== -1 ? idx4 : endAfter4Abs);
    const s4 = seg(idx4, endAfter4Abs);
    const header = markerIdx !== -1 ? lines[markerIdx] : markerText;
    const out = [header, ...s1, ...s2, ...s3, ...s4];
    const filtered = out.filter((l, i) => i === 0 || !markers.some(m => l.includes(m)));
    return filtered.join("\n").trim();
  };

  const dedupeTopSections = (text: string) => {
    const lines = text.split(/\r?\n/);
    const out: string[] = [];
    let prevTop: string | null = null;
    for (const line of lines) {
      if (/^#\s*\d+\.\s+/.test(line)) {
        if (prevTop === line) continue;
        prevTop = line;
        out.push(line);
      } else {
        out.push(line);
      }
    }
    return out.join("\n");
  };

  const stripDuplicateStructures = (text: string) => {
    const lines = text.split(/\r?\n/);
    const top1Idxs: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (/^#\s*1\.\s+/.test(lines[i])) {
        top1Idxs.push(i);
      }
    }
    const markerPatterns = [
      "提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。",
      "Notice: This is locally generated fallback content",
      "注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。",
    ];
    const markerLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (markerPatterns.some(m => lines[i].includes(m))) {
        markerLines.push(i);
      }
    }
    // If fallback marker exists, keep structure starting at or after first marker,
    // and drop anything after the second marker (if present).
    if (markerLines.length > 0) {
      const firstMarkerLine = markerLines[0];
      const secondMarkerLine = markerLines.length > 1 ? markerLines[1] : -1;
      const startStructIdx = top1Idxs.find(idx => idx >= firstMarkerLine) ?? (top1Idxs.length ? top1Idxs[top1Idxs.length - 1] : firstMarkerLine);
      const endIdx = secondMarkerLine !== -1 ? secondMarkerLine : lines.length;
      const kept = lines.slice(startStructIdx, endIdx).join("\n");
      return kept.trim();
    }
    // No fallback marker: if multiple structures appear, keep only the first structure and drop remainder
    if (top1Idxs.length <= 1) return text;
    const first = top1Idxs[0];
    const second = top1Idxs[1];
    const kept = lines.slice(first, second).join("\n");
    return kept.trim();
  };

  const hasFullStructure = (text: string) => {
    const lines = text.split(/\r?\n/);
    const findIndex = (regex: RegExp) => lines.findIndex(l => regex.test(l));
    const i1 = findIndex(/(标题候选|Title Candidates|タイトル候補)/);
    const i2 = findIndex(/(内容大纲|Outline|アウトライン)/);
    const i3 = findIndex(/(正文|Body|本文)/);
    const i4 = findIndex(/(结尾总结|行动建议|Conclusion|結論)/);
    return i1 !== -1 && i2 !== -1 && i3 !== -1 && i4 !== -1 && i1 < i2 && i2 < i3 && i3 < i4;
  };

  const getTitleCandidateCount = (text: string) => {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex(l => /(标题候选|Title Candidates|タイトル候補)/.test(l));
    if (start === -1) return 0;
    const end = lines.findIndex((l, idx) => idx > start && /(内容大纲|Outline|アウトライン|正文|Body|本文|结尾总结|行动建议|Conclusion|結論)/.test(l));
    const segment = lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
    const perLine = segment.split(/\r?\n/).filter(l => /^\s*##\s+/.test(l)).length;
    const inline = (segment.match(/(?:^|\s)##\s/g) || []).length;
    return Math.max(perLine, inline);
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
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        signal,
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
      let fallbackStreamHit = false;
      let lastChunkAt = Date.now();
      const watchdogId = window.setInterval(() => {
        const now = Date.now();
        if (now - lastChunkAt > 12000) {
          try {
            controller.abort();
          } catch {}
        }
      }, 1000);

      if (!reader) {
        throw new Error("无法读取响应流");
      }

      // Throttled update using requestAnimationFrame
      const scheduleUpdate = () => {
        if (!pendingUpdate) {
          pendingUpdate = true;
          rafId = requestAnimationFrame(() => {
            let liveText = normalizeTitleCandidates(fullText, formData.keyword, formData.language);
            liveText = normalizeOutline(liveText);
            liveText = normalizeTopSections(liveText);
            liveText = dedupeTopSections(liveText);
            setOutput(liveText);
            pendingUpdate = false;
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (rafId !== null) cancelAnimationFrame(rafId);
          let endText = normalizeTitleCandidates(fullText, formData.keyword, formData.language);
          endText = normalizeOutline(endText);
          endText = normalizeTopSections(endText);
          endText = dedupeTopSections(endText);
          endText = stripDuplicateStructures(endText);
          setOutput(endText);
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
              showFallbackToast(ftLabel, statusText);
              showedFallbackNotice = true;
            }
            if (meta && meta.source === "local_fallback_stream") {
              fallbackStreamHit = true;
            } else if (content) {
              fullText += content;
              if (!firstChunkReceived) {
                setIsLoading(false);
                firstChunkReceived = true;
              }
              scheduleUpdate();
              lastChunkAt = Date.now();
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
            const meta = (json as { meta?: { source?: string } }).meta;
            if (meta && meta.source === "local_fallback_stream") {
              fallbackStreamHit = true;
            } else if (content) {
              fullText += content;
              if (!firstChunkReceived) {
                setIsLoading(false);
                firstChunkReceived = true;
              }
              let liveText2 = normalizeTitleCandidates(fullText, formData.keyword, formData.language);
              liveText2 = normalizeOutline(liveText2);
              liveText2 = normalizeTopSections(liveText2);
              liveText2 = dedupeTopSections(liveText2);
              liveText2 = stripDuplicateStructures(liveText2);
              setOutput(liveText2);
              lastChunkAt = Date.now();
            }
          } catch {}
        }
      }
      if (watchdogId) {
        clearInterval(watchdogId);
      }

      // Fallback to non-stream if empty
      if (!fullText || fullText.trim().length === 0 || fallbackStreamHit) {
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
              let endText2 = normalizeTitleCandidates(fullText, formData.keyword, formData.language);
              endText2 = normalizeOutline(endText2);
              endText2 = normalizeTopSections(endText2);
              endText2 = dedupeTopSections(endText2);
              endText2 = stripDuplicateStructures(endText2);
              endText2 = enforceFallbackShape(endText2);
              setOutput(endText2);
              setIsLoading(false);
              const src = resp.headers.get("X-Source");
              const ft = resp.headers.get("X-Failure-Type") || data?.meta?.failureType;
              if (!showedFallbackNotice && (src === "local_fallback" || data?.meta?.source === "local_fallback")) {
                const ftLabel = ft === "API" ? "上游服务/限流" : "本地参数/配置";
                showFallbackToast(ftLabel);
                showedFallbackNotice = true;
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
        const lang = formData.language;
        const hasBody =
          (lang === "中文" && /正文/.test(text)) ||
          (lang === "English" && /Body/i.test(text)) ||
          (lang === "日本語" && /本文/.test(text));
        const hasConclusion =
          (lang === "中文" && /(结尾总结|总结|行动建议)/.test(text)) ||
          (lang === "English" && /Conclusion/i.test(text)) ||
          (lang === "日本語" && /結論/.test(text));
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
      let didAutoComplete = false;
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
                newText = content2;
                setOutput(fullText + "\n\n" + newText);
                didAutoComplete = true;
              } else {
                throw new Error("自动续写失败");
              }
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
            const lines = buffer2.split('\n');
            buffer2 = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const obj = JSON.parse(data) as { content?: string };
                  if (obj.content) {
                    newText += obj.content;
                    if (!firstChunkReceived2) {
                      setIsLoading(false);
                      firstChunkReceived2 = true;
                    }
                    setOutput(fullText + "\n\n" + newText);
                  }
                } catch {}
              }
            }
          }
          if (buffer2.trim()) {
            const trimmed = buffer2.trim();
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data !== '[DONE]') {
                try {
                  const obj = JSON.parse(data) as { content?: string };
                  if (obj.content) {
                    newText += obj.content;
                    setOutput(fullText + "\n\n" + newText);
                  }
                } catch {}
              }
            }
          }
          if (newText) {
            finalText = fullText + "\n\n" + newText;
            toast.success("已自动续写补全");
            didAutoComplete = true;
          }
        } catch (e) {
          console.error("Auto-complete error:", e);
        } finally {
          setIsLoading(false);
        }
      }

      // If fallback marker exists, keep content from the first marker onward
      if (finalText) {
        const markers = [
          "提示：当前内容为生成失败后的兜底内容（本地生成），仅供参考。",
          "Notice: This is locally generated fallback content",
          "注意：これは生成失敗・レート制限時のローカルフォールバックです。参考用。",
        ];
        let firstIdx = -1;
        for (const m of markers) {
          const idx = finalText.indexOf(m);
          if (idx !== -1) {
            if (firstIdx === -1 || idx < firstIdx) firstIdx = idx;
          }
        }
        if (firstIdx !== -1) {
          finalText = finalText.slice(firstIdx).trim();
        }
        // If the marker appears twice, drop from the second occurrence
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

      if (finalText) {
        finalText = normalizeTitleCandidates(finalText, formData.keyword, formData.language);
        finalText = normalizeOutline(finalText);
        finalText = normalizeTopSections(finalText);
        finalText = dedupeTopSections(finalText);
        finalText = stripDuplicateStructures(finalText);
        finalText = enforceFallbackShape(finalText);
        finalText = clampOutputToLength(finalText, formData.length, formData.language, formData.autoComplete);
        setOutput(finalText);
        if (formData.autoComplete && !hasFallbackMarker(finalText)) {
          const hasConclusionTop = /(结尾总结|行动建议|结语)/.test(finalText);
          if (!hasConclusionTop) {
            try {
              setIsLoading(true);
              const respC = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...formData,
                  isContinue: true,
                  previousContent: `${finalText.trim()}\n\n# 4. 结尾总结或行动建议\n`,
                  stream: false,
                }),
              });
              if (respC.ok) {
                const dataC = await respC.json();
                if (dataC?.content) {
                  finalText = `${finalText.trim()}\n\n# 4. 结尾总结或行动建议\n\n${dataC.content}`.trim();
                  finalText = normalizeTitleCandidates(finalText, formData.keyword, formData.language);
                  finalText = normalizeOutline(finalText);
                  finalText = normalizeTopSections(finalText);
                  finalText = dedupeTopSections(finalText);
                  setOutput(finalText);
                }
              }
            } catch {}
            finally {
              setIsLoading(false);
            }
          }
        }
        // If structure or candidates look incomplete, try a non-stream regeneration once
        const incompleteStructure = !hasFullStructure(finalText);
        const candidateCount = getTitleCandidateCount(finalText);
        const isFallbackFinal = hasFallbackMarker(finalText);
        if (!didAutoComplete && !isFallbackFinal && (incompleteStructure || candidateCount < 3)) {
          try {
            setIsLoading(true);
            const resp3 = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...formData, stream: false }),
            });
            if (resp3.ok) {
              const data3 = await resp3.json();
              if (data3?.content) {
                finalText = data3.content;
                finalText = normalizeTitleCandidates(finalText, formData.keyword, formData.language);
                finalText = normalizeOutline(finalText);
                finalText = normalizeTopSections(finalText);
                finalText = dedupeTopSections(finalText);
                finalText = clampOutputToLength(finalText, formData.length, formData.language, formData.autoComplete);
                setOutput(finalText);
              } else {
                const kw = formData.keyword;
                const lc = formData.language;
                let addBody = "";
                if (lc === "English") {
                  addBody = `3. Body\n${kw} — ${formData.description}\n`;
                } else if (lc === "日本語") {
                  addBody = `3. 本文\n${kw} — ${formData.description}\n`;
                } else {
                  addBody = `3. 正文\n${kw} — ${formData.description}\n`;
                }
                finalText = `${finalText.trim()}\n\n${addBody}`.trim();
                finalText = normalizeTopSections(finalText);
                finalText = dedupeTopSections(finalText);
                finalText = clampOutputToLength(finalText, formData.length, formData.language, formData.autoComplete);
                setOutput(finalText);
              }
            }
          } catch {}
          finally {
            setIsLoading(false);
          }
        }
        // Auto-complete: ensure completeness without enforcing max length
        if (formData.autoComplete && !hasFallbackMarker(finalText)) {
          const hasBodyTop = /(正文|Body|本文)/.test(finalText);
          const hasConclusionTop = /(结尾总结|行动建议|Conclusion|結論|结语)/.test(finalText);
          const lines = finalText.split(/\r?\n/);
          const idxConclusionTop = lines.findIndex(l => /^#\s*4\.\s+/.test(l));
          let conclusionLen = 0;
          if (idxConclusionTop !== -1) {
            const nextTop = lines.slice(idxConclusionTop + 1).findIndex(l => /^#\s*\d+\.\s+/.test(l));
            const endIdx = nextTop === -1 ? lines.length : idxConclusionTop + 1 + nextTop;
            const seg = lines.slice(idxConclusionTop + 1, endIdx).join("\n");
            conclusionLen = getCharCount(seg);
          }
          const needConclusionFill = !hasConclusionTop || conclusionLen < 50;
          const needBodyFill = !hasBodyTop;
          let loops = 0;
          while ((needBodyFill || needConclusionFill) && loops < 2) {
            try {
              setIsLoading(true);
              const respFill = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...formData,
                  isContinue: true,
                  previousContent: finalText,
                  stream: false,
                }),
              });
              if (respFill.ok) {
                const dataFill = await respFill.json();
                if (dataFill?.content) {
                  finalText = `${finalText}\n\n${dataFill.content}`.trim();
                  finalText = normalizeTitleCandidates(finalText, formData.keyword, formData.language);
                  finalText = normalizeOutline(finalText);
                  finalText = normalizeTopSections(finalText);
                  finalText = dedupeTopSections(finalText);
                  // Do not clamp when autoComplete is enabled
                  setOutput(finalText);
                }
              }
            } catch {}
            finally {
              setIsLoading(false);
            }
            loops += 1;
          }
        }
        // Ensure fallback content still conforms to expected structure if missing
        const stillIncomplete = !hasFullStructure(finalText);
        if (stillIncomplete && !hasFallbackMarker(finalText)) {
          const kw = formData.keyword;
          const lc = formData.language;
          let addCandidates = "";
          let addOutline = "";
          if (lc === "English") {
            addCandidates = `1. Title Candidates (3)\n## ${kw}: Key Points and Practice\n## ${kw} Strategy Guide\n## ${kw} Case Notes\n`;
            addOutline = `2. Outline\n## Origins and background\n## Main categories and development\n`;
          } else if (lc === "日本語") {
            addCandidates = `1. タイトル候補（3）\n## ${kw}の要点と実践\n## ${kw}戦略ガイド\n## ${kw}ケースメモ\n`;
            addOutline = `2. アウトライン\n## 起源と背景\n## 主な分類と発展\n`;
          } else {
            addCandidates = `1. 标题候选(3个)\n## ${kw}：核心要点与实践\n## ${kw}应用攻略\n## ${kw}策略笔记\n`;
            addOutline = `2. 内容大纲\n## 起源与背景\n## 主要分类与发展脉络\n`;
          }
          const hasCandidates = /(标题候选|Title Candidates|タイトル候補)/.test(finalText);
          const hasOutline = /(内容大纲|Outline|アウトライン)/.test(finalText);
          const hasBody = /(正文|Body|本文)/.test(finalText);
          const hasConclusion = /(结尾总结|行动建议|Conclusion|結論|结语)/.test(finalText);
          let prefix = "";
          if (!hasCandidates) prefix += `${addCandidates}\n`;
          if (!hasOutline) prefix += `${addOutline}\n`;
          let suffix = "";
          if (!hasBody) {
            if (lc === "English") suffix += `\n3. Body\n${kw} — ${formData.description}\n`;
            else if (lc === "日本語") suffix += `\n3. 本文\n${kw} — ${formData.description}\n`;
            else suffix += `\n3. 正文\n${kw} — ${formData.description}\n`;
          }
          finalText = `${prefix}${finalText.trim()}${suffix}`.trim();
          finalText = normalizeTopSections(finalText);
          finalText = dedupeTopSections(finalText);
          finalText = clampOutputToLength(finalText, formData.length, formData.language, formData.autoComplete);
          setOutput(finalText);
          if (formData.autoComplete) {
            try {
              setIsLoading(true);
              const resp4 = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...formData,
                  isContinue: true,
                  previousContent: finalText,
                  stream: false,
                }),
              });
              if (resp4.ok) {
                const data4 = await resp4.json();
                if (data4?.content) {
                  finalText = `${finalText}\n\n${data4.content}`.trim();
                  finalText = normalizeTitleCandidates(finalText, formData.keyword, formData.language);
                  finalText = normalizeOutline(finalText);
                  finalText = normalizeTopSections(finalText);
                  finalText = dedupeTopSections(finalText);
                  finalText = clampOutputToLength(finalText, formData.length, formData.language, formData.autoComplete);
                  setOutput(finalText);
                }
              }
            } catch {}
            finally {
              setIsLoading(false);
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
      if (err instanceof Error && err.name === "AbortError") {
        try {
          const resp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...formData, stream: false }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.content) {
              let finalText = data.content;
              finalText = normalizeTitleCandidates(finalText, formData.keyword, formData.language);
              finalText = normalizeOutline(finalText);
              finalText = normalizeTopSections(finalText);
              finalText = dedupeTopSections(finalText);
              finalText = stripDuplicateStructures(finalText);
              finalText = enforceFallbackShape(finalText);
              finalText = clampOutputToLength(finalText, formData.length, formData.language, formData.autoComplete);
              setOutput(finalText);
              toast.info("检测到生成中断，已自动兜底重生成");
            } else {
              throw new Error("未返回有效内容");
            }
          } else {
            // Try auto-continue if we have partial content
            if (output && output.trim().length > 0) {
              const resp2 = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...formData,
                  isContinue: true,
                  previousContent: output,
                  stream: false,
                }),
              });
              if (resp2.ok) {
                const data2 = await resp2.json();
                const c2 = data2?.content;
                if (c2) {
                  const merged = `${output}\n\n${c2}`;
                  setOutput(merged);
                  toast.info("生成中断后已自动续写补全");
                } else {
                  throw new Error("未返回有效内容");
                }
              } else {
                throw new Error("兜底续写失败");
              }
            } else {
              throw new Error("生成被中断，请重试");
            }
          }
        } catch (e2) {
          const msg = e2 instanceof Error ? e2.message : "生成被中断，请重试";
          setError(msg);
          toast.error(msg);
        }
        return;
      } else {
        const errorMessage = err instanceof Error ? err.message : "生成失败，请重试";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [formData, output, setError, setIsLoading, setOutput, onHistorySaved]);

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
      const basePrefix = `${output.trimEnd()}\n\n---------续写---------\n\n`;
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
      let fallbackStreamHit = false;

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
                showFallbackToast(ftLabel);
                showedFallbackNotice = true;
              }
            if (meta && meta.source === "local_fallback_stream") {
              fallbackStreamHit = true;
            } else if (obj.content) {
                newText += obj.content;
                if (!firstChunkReceived) {
                  setIsLoading(false);
                  firstChunkReceived = true;
                }
                setOutput(basePrefix + newText);
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
              if (obj.meta && obj.meta.source === "local_fallback_stream") {
                fallbackStreamHit = true;
              } else if (obj.content) {
                newText += obj.content;
              if (!firstChunkReceived) {
                setIsLoading(false);
                firstChunkReceived = true;
              }
              setOutput(basePrefix + newText);
            }
          } catch (e) {
            console.error('Failed to parse final SSE data:', e);
          }
        }
      }

      // Fallback to non-stream continue if empty
      if (!newText || newText.trim().length === 0 || fallbackStreamHit) {
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
              const src = resp.headers.get("X-Source");
              const ft = resp.headers.get("X-Failure-Type") || data?.meta?.failureType;
              if (src === "local_fallback" || data?.meta?.source === "local_fallback") {
                const ftLabel = ft === "API" ? "上游服务/限流" : "本地参数/配置";
                showFallbackToast(ftLabel);
                setIsLoading(false);
                return;
              } else if (data?.content) {
                newText = data.content;
                setOutput(basePrefix + newText);
                setIsLoading(false);
              }
            }
          } else {
            const data = await resp.json().catch(() => ({}));
            const ft = data?.failureType === "API" ? "上游服务/限流" : "本地参数/配置";
            throw new Error(`续写失败（${ft}）：${data?.error || "请重试"}`);
          }
        } catch {}
      }

      // Second fallback if content is still too short
      if (newText && newText.trim().length < 100) {
        try {
          const resp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...formData,
              isContinue: true,
              previousContent: output + "\n\n" + newText,
              stream: false,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.content) {
              newText += "\n\n" + data.content;
              setOutput(basePrefix + newText);
              setIsLoading(false);
            }
          }
        } catch (e) {
          console.error('Failed to perform second fallback continue:', e);
        }
      }

      if (newText) {
        // Update the latest matching history item by appending continue text
        try {
          const base = findLatestByContent(formData.keyword, output);
          const finalOut = basePrefix + newText;
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
