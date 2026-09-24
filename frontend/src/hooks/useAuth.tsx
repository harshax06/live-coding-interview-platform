import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { login as apiLogin, signup as apiSignup } from "../lib/api";

export interface AuthUser {
    userId: number;
    email: string;
    role: "INTERVIEWER" | "CANDIDATE";
}

const STORAGE_KEY = "interview-platform-token";

// The backend signs this token and the browser only just received it (moments ago, over
// HTTPS-in-production) - reading its claims client-side to drive UI is fine. This is NOT
// signature verification; the server still re-validates every request independently.
function decodeUser(token: string): AuthUser | null {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return { userId: payload.userId, email: payload.sub, role: payload.role };
    } catch {
        return null;
    }
}

interface AuthContextValue {
    token: string | null;
    user: AuthUser | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name: string, role: "INTERVIEWER" | "CANDIDATE") => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Token-in-localStorage auth, shared app-wide via Context (was a plain per-component hook
 * through Day 39 - fine when only FeedbackPanel used it, but Login/Signup/Dashboard/Nav all
 * needing the SAME reactive auth state is exactly what a shared hook re-reading localStorage
 * independently per component can't guarantee without this). Still scoped to what the app
 * actually needs: no refresh tokens, no session expiry handling beyond what the backend's
 * JWT itself enforces server-side on every request.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
    const [user, setUser] = useState<AuthUser | null>(() => {
        const existing = localStorage.getItem(STORAGE_KEY);
        return existing ? decodeUser(existing) : null;
    });

    const applyToken = useCallback((t: string) => {
        localStorage.setItem(STORAGE_KEY, t);
        setToken(t);
        setUser(decodeUser(t));
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const { token: t } = await apiLogin(email, password);
        applyToken(t);
    }, [applyToken]);

    const signup = useCallback(async (email: string, password: string, name: string, role: "INTERVIEWER" | "CANDIDATE") => {
        const { token: t } = await apiSignup(email, password, name, role);
        applyToken(t);
    }, [applyToken]);

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ token, user, login, signup, logout }}>
    {children}
    </AuthContext.Provider>
);
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
}