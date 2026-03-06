import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { LangopiaClient } from "@langopia/api-client";
import { storage } from "@/lib/storage";
import type { UserPlan } from "@langopia/shared/types";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:2501";

const TOKEN_KEY = "langopia.accessToken";
const REFRESH_KEY = "langopia.refreshToken";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: UserPlan;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: check SecureStore for existing tokens
  useEffect(() => {
    (async () => {
      const storedAccess = await storage.getItem(TOKEN_KEY);
      const storedRefresh = await storage.getItem(REFRESH_KEY);

      if (!storedAccess) {
        setLoading(false);
        return;
      }

      setAccessToken(storedAccess);
      setRefreshToken(storedRefresh);

      // Fetch profile to validate tokens
      const client = new LangopiaClient({
        baseUrl: API_URL,
        accessToken: storedAccess,
        refreshToken: storedRefresh ?? undefined,
        onTokenRefresh: (tokens) => {
          storage.setItem(TOKEN_KEY, tokens.accessToken);
          if (tokens.refreshToken) {
            storage.setItem(REFRESH_KEY, tokens.refreshToken);
          }
          setAccessToken(tokens.accessToken);
          if (tokens.refreshToken) setRefreshToken(tokens.refreshToken);
        },
      });

      try {
        const profile = await client.userProfile.getProfile();
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          plan: profile.plan as UserPlan,
        });
      } catch {
        // Tokens expired and refresh failed — clear
        await storage.deleteItem(TOKEN_KEY);
        await storage.deleteItem(REFRESH_KEY);
        setAccessToken(null);
        setRefreshToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const client = new LangopiaClient({ baseUrl: API_URL });
    const res = await client.auth.login({ email, password });

    await storage.setItem(TOKEN_KEY, res.accessToken);
    await storage.setItem(REFRESH_KEY, res.refreshToken);
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    setUser({
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      plan: res.user.plan as UserPlan,
    });
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const client = new LangopiaClient({ baseUrl: API_URL });
      const res = await client.auth.register({ name, email, password });

      await storage.setItem(TOKEN_KEY, res.accessToken);
      await storage.setItem(REFRESH_KEY, res.refreshToken);
      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setUser({
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        plan: res.user.plan as UserPlan,
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    // Best-effort: unregister push token before clearing credentials
    try {
      const currentAccess = await storage.getItem(TOKEN_KEY);
      if (currentAccess) {
        const { unregisterPushToken } = await import("@/lib/notifications");
        const client = new LangopiaClient({
          baseUrl: API_URL,
          accessToken: currentAccess,
        });
        await unregisterPushToken(client);
      }
    } catch {
      // Don't block logout on push token unregistration failure
    }

    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(REFRESH_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        loading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthValue: AuthContextValue = {
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: () => {},
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  // Return safe defaults if called before AuthProvider mounts (Expo Router v6 eager rendering)
  return ctx ?? defaultAuthValue;
}
