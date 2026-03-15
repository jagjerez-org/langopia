let storage: {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  clearAll(): void;
};

try {
  const { createMMKV } = require("react-native-mmkv");
  storage = createMMKV({ id: "langopia-cache" });
} catch {
  // Fallback for Expo Go (MMKV requires native modules)
  const map = new Map<string, string>();
  storage = {
    getString: (key: string) => map.get(key),
    set: (key: string, value: string) => { map.set(key, value); },
    remove: (key: string) => { map.delete(key); },
    clearAll: () => { map.clear(); },
  };
}

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
  classes: (status: string) => `classes:${status}`,
  classDetail: (id: string) => `class:${id}`,
  reports: () => "reports",
  reportDetail: (id: string) => `report:${id}`,
  homeStats: () => "home:stats",
};
