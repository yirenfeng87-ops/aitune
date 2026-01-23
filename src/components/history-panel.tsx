"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Trash2, Clock, FileText, Star } from "lucide-react";
import { toast } from "sonner";
import {
  getHistory,
  deleteHistoryItem,
  clearHistory,
  toggleFavorite,
  type HistoryItem,
} from "@/lib/history";
import { TEMPLATES } from "@/lib/templates";

interface HistoryPanelProps {
  onSelectHistory: (item: HistoryItem) => void;
}

export function HistoryPanel({ onSelectHistory }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const items = getHistory();
    setHistory(items);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteHistoryItem(id);
    loadHistory();
    toast.success("历史记录已删除");
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(id);
    loadHistory();
    const item = history.find(h => h.id === id);
    toast.success(item?.isFavorite ? "已取消收藏" : "已收藏");
  };

  const handleClearAll = () => {
    if (history.length === 0) return;

    if (confirm("确定要清空所有历史记录吗？")) {
      clearHistory();
      loadHistory();
      toast.success("历史记录已清空");
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with clear button */}
      {history.length > 0 && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b px-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <History className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">历史记录</p>
              <p className="text-xs text-muted-foreground">
                共 {history.length} 条记录
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-8 text-xs text-muted-foreground hover:text-destructive"
          >
            清空
          </Button>
        </div>
      )}

      {/* History list */}
      <ScrollArea className="flex-1 -mx-1">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center px-4">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <History className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">暂无历史记录</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              生成的内容会自动保存在这里，方便随时查看
            </p>
          </div>
        ) : (
          <div className="space-y-3 px-1 pb-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-accent-foreground/20 cursor-pointer transition-all duration-200 overflow-hidden"
                onClick={() => onSelectHistory(item)}
              >
                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Title */}
                      <h4 className="text-sm font-semibold text-foreground truncate">
                        {item.keyword}
                      </h4>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Meta info */}
                      <div className="flex items-center flex-wrap gap-2 pt-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(item.timestamp)}</span>
                        </div>
                        <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        <span className="text-xs text-muted-foreground font-medium">
                          {item.model.split("/")[1]?.split(":")[0] || item.model}
                        </span>
                        {item.template && (() => {
                          const template = TEMPLATES.find(t => t.id === item.template);
                          return template ? (
                            <>
                              <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                              <span className="text-xs text-muted-foreground font-medium">
                                {template.icon} {template.name}
                              </span>
                            </>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      {/* Star/Favorite button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 transition-all ${
                          item.isFavorite
                            ? "text-yellow-500 hover:text-yellow-600"
                            : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-500"
                        }`}
                        onClick={(e) => handleToggleFavorite(item.id, e)}
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${item.isFavorite ? "fill-current" : ""}`}
                        />
                      </Button>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(item.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Hover indicator */}
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
