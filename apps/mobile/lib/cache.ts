import { createMMKV } from "react-native-mmkv";

const storage = createMMKV({ id: "langopia-cache" });

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const cache = {
  get<T>(key: string, ttl = DEFAULT_TTL_MS): T | null {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.timestamp > ttl) return null;
      return entry.data;
    } catch {
      return null;
    }
  },

  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    storage.set(key, JSON.stringify(entry));
  },

  getStale<T>(key: string): T | null {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      return entry.data;
    } catch {
      return null;
    }
  },

  delete(key: string): void {
    storage.remove(key);
  },

  clearAll(): void {
    storage.clearAll();
  },
};

export const CacheKeys = {
  lessons: (params?: Record<string, unknown>) =>
    `lessons:${params ? JSON.stringify(params) : "all"}`,
  lessonDetail: (id: string) => `lesson:${id}`,
  exercises: (params?: Record<string, unknown>) =>
    `exercises:${params ? JSON.stringify(params) : "all"}`,
  exerciseDetail: (id: string) => `exercise:${id}`,
  notifications: () => "notifications",
};
