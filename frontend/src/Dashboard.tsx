import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { listPastSessions, ApiError, type PastSession } from "./lib/api";

function formatDate(ms: number | null): string {
    if (ms == null) return "unknown date";
    return new Date(ms).toLocaleString(undefined, {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
}

function formatRelative(ms: number | null): string {
    if (ms == null) return "";
    const diffMs = Date.now() - ms;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

function formatDuration(startedAt: number | null, endedAt: number | null): string {
    if (startedAt == null || endedAt == null) return "--:--";
    const totalSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type SortKey = "newest" | "oldest" | "highest" | "lowest";

const SORTERS: Record<SortKey, (a: PastSession, b: PastSession) => number> = {
    newest: (a, b) => new Date(b.feedbackGivenAt).getTime() - new Date(a.feedbackGivenAt).getTime(),
    oldest: (a, b) => new Date(a.feedbackGivenAt).getTime() - new Date(b.feedbackGivenAt).getTime(),
    highest: (a, b) => (b.myRating ?? 0) - (a.myRating ?? 0),
    lowest: (a, b) => (a.myRating ?? 0) - (b.myRating ?? 0),
};

/**
 * The interviewer's list of past sessions (Day 39, polished Day 40). "Past session" = a
 * recording this interviewer left an overall rating on - see DashboardController for why
 * that's the signal used, rather than a dedicated Session table the live app never
 * actually populates.
 */
function Dashboard() {
    // ProtectedRoute (role="INTERVIEWER") already guarantees an authenticated
    // interviewer before this renders - no inline login form needed here anymore.
    const { token, user, logout } = useAuth();
    if (!token || !user) return null;
    const [sessions, setSessions] = useState<PastSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [minRating, setMinRating] = useState(0);
    const [sort, setSort] = useState<SortKey>("newest");

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        setError(null);
        listPastSessions(token)
            .then(setSessions)
            .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load your sessions"))
            .finally(() => setLoading(false));
    }, [token]);

    const stats = useMemo(() => {
        if (sessions.length === 0) return null;
        const rated = sessions.filter((s) => s.myRating != null);
        const avg = rated.length > 0 ? rated.reduce((sum, s) => sum + (s.myRating ?? 0), 0) / rated.length : null;
        const totalMs = sessions.reduce(
            (sum, s) => sum + (s.startedAt != null && s.endedAt != null ? s.endedAt - s.startedAt : 0),
            0
        );
        return { count: sessions.length, avg, totalMinutes: Math.round(totalMs / 60000) };
    }, [sessions]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return sessions
            .filter((s) => (q === "" || s.roomCode.toLowerCase().includes(q)) && (s.myRating ?? 0) >= minRating)
            .sort(SORTERS[sort]);
    }, [sessions, search, minRating, sort]);

    return (
        <div style={{ minHeight: "100vh", background: "#1e1e1e", color: "#fff", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0 }}>Your past sessions</h2>
                {token && user && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#888" }}>
                        <span>{user.email}</span>
                        <button onClick={logout}>Log out</button>
                    </div>
                )}
            </div>

            {user.role !== "INTERVIEWER" ? (
                <div style={{ color: "#f9a825" }}>Only interviewer accounts have a dashboard.</div>
            ) : (
                <>
                    {loading && <SkeletonList />}

                    {error && (
                        <div style={{ color: "#f48771", marginBottom: 12 }}>
                            {error}{" "}
                            <button onClick={() => token && listPastSessions(token).then(setSessions).catch(() => {})}>
                                Retry
                            </button>
                        </div>
                    )}

                    {!loading && !error && sessions.length === 0 && (
                        <div style={{ color: "#888" }}>
                            No rated sessions yet - leave an overall rating from a room's feedback panel
                            and it will show up here.
                        </div>
                    )}

                    {!loading && !error && sessions.length > 0 && (
                        <>
                            {stats && (
                                <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                                    <StatCard label="Sessions rated" value={String(stats.count)} />
                                    <StatCard
                                        label="Average rating"
                                        value={stats.avg != null ? stats.avg.toFixed(1) : "--"}
                                    />
                                    <StatCard label="Total time reviewed" value={`${stats.totalMinutes}m`} />
                                </div>
                            )}

                            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                                <input
                                    placeholder="Search by room code..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ flex: "1 1 180px" }}
                                />
                                <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
                                    <option value={0}>Any rating</option>
                                    {[5, 4, 3, 2, 1].map((r) => (
                                        <option key={r} value={r}>{r}+ stars</option>
                                    ))}
                                </select>
                                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                                    <option value="newest">Newest first</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="highest">Highest rated</option>
                                    <option value="lowest">Lowest rated</option>
                                </select>
                            </div>

                            {visible.length === 0 ? (
                                <div style={{ color: "#888" }}>No sessions match those filters.</div>
                            ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                                    {visible.map((s) => (
                                        <SessionCard key={s.recordingId} session={s} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ background: "#252525", borderRadius: 6, padding: "8px 14px", minWidth: 110 }}>
            <div style={{ fontSize: 20, fontWeight: "bold" }}>{value}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
        </div>
    );
}

function SkeletonList() {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {[0, 1, 2].map((i) => (
                <div key={i} style={{ background: "#252525", borderRadius: 6, padding: 12, opacity: 0.5 }}>
                    <div style={{ height: 14, width: "60%", background: "#3a3a3a", borderRadius: 3, marginBottom: 8 }} />
                    <div style={{ height: 10, width: "40%", background: "#3a3a3a", borderRadius: 3, marginBottom: 12 }} />
                    <div style={{ height: 10, width: "80%", background: "#3a3a3a", borderRadius: 3 }} />
                </div>
            ))}
        </div>
    );
}

function SessionCard({ session }: { session: PastSession }) {
    const replayHref = `/?replay=${encodeURIComponent(session.roomCode)}&recordingId=${encodeURIComponent(session.recordingId)}`;

    return (
        <div style={{ background: "#252525", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.roomCode}
                </div>
                <div style={{ color: "#888", fontSize: 11, flexShrink: 0 }} title={formatDate(session.startedAt)}>
                    {formatRelative(session.startedAt)}
                </div>
            </div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
                {formatDuration(session.startedAt, session.endedAt)} - {session.eventCount} events
            </div>
            <div style={{ marginTop: 6 }}>
                <span style={{ color: "#f9a825" }}>{"\\u2605".repeat(session.myRating ?? 0)}</span>
                <span style={{ color: "#555" }}>{"\\u2605".repeat(5 - (session.myRating ?? 0))}</span>
            </div>
            {session.myComment && (
                <div style={{ marginTop: 4, fontSize: 13, flex: 1 }}>{session.myComment}</div>
            )}
            <a href={replayHref} style={{ display: "inline-block", marginTop: 8, color: "#4fc3f7" }}>
                View replay &rarr;
            </a>
        </div>
    );
}


export default Dashboard;