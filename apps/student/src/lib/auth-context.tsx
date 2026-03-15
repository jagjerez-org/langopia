"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getApiClient, setAuthTokens, clearAuthTokens, isAuthenticated } from "./api";

interface StudentUser {
  id: string;
  email: string;
  name: string;
}

interface StudentData {
  id: string;
  academyId: string;
  onboardingCompleted?: boolean;
}

interface AuthContextValue {
  user: StudentUser | null;
  student: StudentData | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (email: string, password: string, academyId: string) => Promise<void>;
  register: (email: string, password: string, name: string, academyId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  student: null,
  isLoggedIn: false,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore from localStorage
    if (isAuthenticated()) {
      const stored = localStorage.getItem("student_data");
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setUser(data.user);
          setStudent(data.student);
        } catch {
          clearAuthTokens();
        }
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, academyId: string) => {
    const client = getApiClient();
    const res = await client.studentApp.login({ email, password, academyId });
    setAuthTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    setStudent(res.student);
    localStorage.setItem("student_data", JSON.stringify({ user: res.user, student: res.student }));

    if (!res.student.onboardingCompleted) {
      router.push("/onboarding");
    } else {
      router.push("/home");
    }
  }, [router]);

  const register = useCallback(async (email: string, password: string, name: string, academyId: string) => {
    const client = getApiClient();
    const res = await client.studentApp.register({ email, password, name, academyId });
    setAuthTokens(res.accessToken, res.refreshToken);
    setUser(res.user);
    setStudent(res.student);
    localStorage.setItem("student_data", JSON.stringify({ user: res.user, student: res.student }));
    router.push("/onboarding");
  }, [router]);

  const logout = useCallback(() => {
    clearAuthTokens();
    setUser(null);
    setStudent(null);
    router.push("/auth/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        isLoggedIn: !!user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
