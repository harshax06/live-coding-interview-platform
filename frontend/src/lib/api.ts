// Thin wrapper around the backend's REST API (distinct from the STOMP connection used
// elsewhere) - feedback is the first feature that needs a real authenticated User
// (JwtAuthFilter + @AuthenticationPrincipal), not just an ad hoc STOMP userId string.
const API_BASE = "http://localhost:8080";

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ApiError(res.status, body || `Request failed (${res.status})`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export function login(email: string, password: string) {
    return request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function signup(email: string, password: string, name: string) {
    return request<{ token: string }>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) });
}

export type FeedbackKind = "OVERALL" | "MOMENT";

export interface FeedbackItem {
    id: number;
    roomCode: string;
    recordingId: string;
    authorId: number;
    authorName: string;
    kind: FeedbackKind;
    rating: number | null;
    comment: string | null;
    timestampMs: number | null;
    createdAt: string;
    updatedAt: string | null;
}

export function submitFeedback(
    token: string,
    body: { roomCode: string; recordingId: string; kind: FeedbackKind; rating?: number; comment?: string; timestampMs?: number }
) {
    return request<FeedbackItem>("/api/feedback", { method: "POST", body: JSON.stringify(body) }, token);
}

export function listFeedback(token: string, roomCode: string, recordingId: string) {
    return request<FeedbackItem[]>(
        `/api/feedback?roomCode=${encodeURIComponent(roomCode)}&recordingId=${encodeURIComponent(recordingId)}`,
        { method: "GET" },
        token
    );
}

export interface PastSession {
    roomCode: string;
    recordingId: string;
    startedAt: number | null;
    endedAt: number | null;
    eventCount: number;
    myRating: number | null;
    myComment: string | null;
    feedbackGivenAt: string;
}

export function listPastSessions(token: string) {
    return request<PastSession[]>("/api/dashboard/sessions", { method: "GET" }, token);
}