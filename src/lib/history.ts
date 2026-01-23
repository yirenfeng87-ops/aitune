export interface HistoryItem {
  id: string;
  keyword: string;
  description: string;
  output: string;
  model: string;
  language: string;
  tone: string;
  role: string;
  length: string;
  template?: string;
  timestamp: number;
  isFavorite?: boolean;
}

const HISTORY_KEY = "writingHistory";
const MAX_HISTORY_ITEMS = 20;

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];

    const history = JSON.parse(stored) as HistoryItem[];
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to load history:", error);
    return [];
  }
}

export function addToHistory(item: Omit<HistoryItem, "id" | "timestamp">): HistoryItem {
  const newItem: HistoryItem = {
    ...item,
    id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  const history = getHistory();
  const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Failed to save history:", error);
  }

  return newItem;
}

export function deleteHistoryItem(id: string): void {
  const history = getHistory();
  const updatedHistory = history.filter(item => item.id !== id);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Failed to delete history item:", error);
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error("Failed to clear history:", error);
  }
}

export function toggleFavorite(id: string): void {
  const history = getHistory();
  const updatedHistory = history.map(item =>
    item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
  );

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Failed to toggle favorite:", error);
  }
}

export function getFavorites(): HistoryItem[] {
  return getHistory().filter(item => item.isFavorite);
}
