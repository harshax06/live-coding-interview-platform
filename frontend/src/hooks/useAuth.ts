import { useCallback, useState } from "react";
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

/**
 * Minimal token-in-localStorage auth, scoped to what the feedback feature needs. The rest
 * of the app (presence, edits, runs) still identifies people by an ad hoc STOMP userId
 * string with no real login - this doesn't touch that. There's no dedicated login screen
 * anywhere else in the app yet (not on the roadmap so far), so FeedbackPanel embeds a
 * compact login/signup form directly rather than this being a stopgap for a broader auth UI.
 */
export function useAuth() {
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

    const signup = useCallback(async (email: string, password: string, name: string) => {
        const { token: t } = await apiSignup(email, password, name);
        applyToken(t);
    }, [applyToken]);

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
    }, []);

    return { token, user, login, signup, logout };
}