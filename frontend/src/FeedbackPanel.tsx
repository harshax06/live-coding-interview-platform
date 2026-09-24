import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { listFeedback, submitFeedback, ApiError, type FeedbackItem } from "./lib/api";

interface FeedbackPanelProps {
    roomCode: string;
    recordingId: string | null;
    /**
     * When this tab resolved the recording id (~when it joined). MOMENT timestamps are
     * measured from here, NOT from the recording's actual first event - so for someone who
     * joined a session already in progress, "2:00" here won't exactly match "2:00" on the
     * Day 24/25 replay timeline. Fine for a fresh room (the common case); worth tightening
     * later by threading the recording's true start time through from the backend.
     */
    recordingJoinedAt: number;
}

function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function FeedbackPanel({ roomCode, recordingId, recordingJoinedAt }: FeedbackPanelProps) {
    const { token, user, login, signup, logout } = useAuth();

    if (!recordingId) return null; // nothing to attach feedback to until the recording id resolves

    return (
        <div style={{ padding: 8, background: "#252525", color: "#fff", fontSize: 13 }}>
            {!token || !user ? (
                <AuthGate onLogin={login} onSignup={signup} />
            ) : (
                <SignedInPanel
                    roomCode={roomCode}
                    recordingId={recordingId}
                    recordingJoinedAt={recordingJoinedAt}
                    token={token}
                    user={user}
                    onLogout={logout}
                />
            )}
        </div>
    );
}

function AuthGate({
                      onLogin,
                      onSignup,
                  }: {
    onLogin: (email: string, password: string) => Promise<void>;
    onSignup: (email: string, password: string, name: string) => Promise<void>;
}) {
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setError(null);
        setBusy(true);
        try {
            if (mode === "login") await onLogin(email, password);
            else await onSignup(email, password, name);
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 280 }}>
            <div style={{ color: "#888" }}>
                Sign in to leave feedback (candidates can browse existing feedback once signed in too).
            </div>
            {mode === "signup" && (
                <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={submit} disabled={busy || !email || !password}>
                    {mode === "login" ? "Log in" : "Sign up"}
                </button>
                <button onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                    {mode === "login" ? "Need an account?" : "Have an account?"}
                </button>
            </div>
            {error && <div style={{ color: "#f48771" }}>{error}</div>}
        </div>
    );
}

function SignedInPanel({
                           roomCode,
                           recordingId,
                           recordingJoinedAt,
                           token,
                           user,
                           onLogout,
                       }: {
    roomCode: string;
    recordingId: string;
    recordingJoinedAt: number;
    token: string;
    user: { userId: number; email: string; role: "INTERVIEWER" | "CANDIDATE" };
    onLogout: () => void;
}) {
    const [items, setItems] = useState<FeedbackItem[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    const refresh = () => {
        listFeedback(token, roomCode, recordingId)
            .then(setItems)
            .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Could not load feedback"));
    };

    useEffect(refresh, [token, roomCode, recordingId]);

    const overall = items.find((f) => f.kind === "OVERALL" && f.authorId === user.userId) ?? null;
    const moments = items.filter((f) => f.kind === "MOMENT");

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#888" }}>
                <span>{user.email} ({user.role.toLowerCase()})</span>
                <button onClick={onLogout}>Log out</button>
            </div>

            {loadError && <div style={{ color: "#f48771" }}>{loadError}</div>}

            {user.role === "INTERVIEWER" && (
                <>
                    <OverallRating
                        token={token}
                        roomCode={roomCode}
                        recordingId={recordingId}
                        existing={overall}
                        onSaved={refresh}
                    />
                    <MomentComment
                        token={token}
                        roomCode={roomCode}
                        recordingId={recordingId}
                        recordingJoinedAt={recordingJoinedAt}
                        onSaved={refresh}
                    />
                </>
            )}

            <div>
                <div style={{ color: "#888", marginBottom: 4 }}>
                    Comments {moments.length > 0 && `(${moments.length})`}
                </div>
                {moments.length === 0 && <div style={{ color: "#666" }}>No comments yet.</div>}
                {moments.map((m) => (
                    <div key={m.id} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                        <span style={{ color: "#888", fontFamily: "monospace", flexShrink: 0 }}>
                            {m.timestampMs != null ? formatElapsed(m.timestampMs) : "--:--"}
                        </span>
                        <span style={{ color: "#888", flexShrink: 0 }}>{m.authorName}:</span>
                        <span>{m.comment}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function OverallRating({
                           token,
                           roomCode,
                           recordingId,
                           existing,
                           onSaved,
                       }: {
    token: string;
    roomCode: string;
    recordingId: string;
    existing: FeedbackItem | null;
    onSaved: () => void;
}) {
    const [rating, setRating] = useState(existing?.rating ?? 0);
    const [comment, setComment] = useState(existing?.comment ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Keep the form in sync if the list refetches with a rating this user already saved
    useEffect(() => {
        if (existing) {
            setRating(existing.rating ?? 0);
            setComment(existing.comment ?? "");
        }
    }, [existing?.id, existing?.rating, existing?.comment]);

    const save = async () => {
        if (rating < 1) {
            setError("Pick a rating from 1 to 5");
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await submitFeedback(token, { roomCode, recordingId, kind: "OVERALL", rating, comment });
            onSaved();
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Could not save rating");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ borderBottom: "1px solid #333", paddingBottom: 8 }}>
            <div style={{ color: "#888", marginBottom: 4 }}>
                Overall rating {existing && "(saved - resubmitting updates it)"}
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        onClick={() => setRating(n)}
                        style={{ color: n <= rating ? "#f9a825" : "#555", fontSize: 18, lineHeight: 1 }}
                    >
                        ★
                    </button>
                ))}
            </div>
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Overall notes (optional)"
                rows={2}
                style={{ width: "100%", resize: "vertical" }}
            />
            <button onClick={save} disabled={saving}>
                {existing ? "Update rating" : "Save rating"}
            </button>
            {error && <div style={{ color: "#f48771" }}>{error}</div>}
        </div>
    );
}

function MomentComment({
                           token,
                           roomCode,
                           recordingId,
                           recordingJoinedAt,
                           onSaved,
                       }: {
    token: string;
    roomCode: string;
    recordingId: string;
    recordingJoinedAt: number;
    onSaved: () => void;
}) {
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        if (!comment.trim()) return;
        setError(null);
        setSaving(true);
        try {
            const timestampMs = Date.now() - recordingJoinedAt;
            await submitFeedback(token, { roomCode, recordingId, kind: "MOMENT", comment, timestampMs });
            setComment("");
            onSaved();
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Could not add comment");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ borderBottom: "1px solid #333", paddingBottom: 8 }}>
            <div style={{ color: "#888", marginBottom: 4 }}>Add a comment at this moment</div>
            <div style={{ display: "flex", gap: 6 }}>
                <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && add()}
                    placeholder="e.g. good approach to the edge case"
                    style={{ flex: 1 }}
                />
                <button onClick={add} disabled={saving || !comment.trim()}>
                    Add at {formatElapsed(Date.now() - recordingJoinedAt)}
                </button>
            </div>
            {error && <div style={{ color: "#f48771" }}>{error}</div>}
        </div>
    );
}

export default FeedbackPanel;