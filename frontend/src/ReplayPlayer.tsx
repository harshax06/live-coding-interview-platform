import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { useStompClient } from "./hooks/useStompClient";

type ReplayMessage = {
    kind: "RECORDINGS" | "STARTED" | "EVENT" | "RESET" | "SEEKED" | "PAUSED" | "FINISHED" | "STOPPED" | "ERROR";
    index: number;
    total: number;
    type: string | null;
    userId: string | null;
    playOffsetMs: number;
    durationMs: number;
    positionMs: number;
    timestamp: number;
    realDurationMs?: number;
    gaps?: { positionMs: number; skippedMs: number }[];
    recordings?: Recording[];
    comments?: { id: number; authorName: string; comment: string; playOffsetMs: number }[];
    overallFeedback?: { authorName: string; rating: number | null; comment: string | null }[];
    payload: string | null;
    instant: boolean;
    message: string | null;
};

type Recording = {
    recordingId: string;
    startedAt: number;   // epoch millis of the first event
    endedAt: number;     // epoch millis of the last event
    eventCount: number;
};

type RunOutput = {
    userId: string;
    language: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
};

type Status = "idle" | "playing" | "paused" | "finished" | "error";

const SPEEDS = [0.5, 1, 2, 4, 8];

function fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Plays a recorded session back. All state is rebuilt from the event log:
 * EDIT events are Yjs updates applied to a fresh Y.Doc (text + selected language),
 * RUN_* events feed the output panel. Seeking = server sends RESET + a burst of events.
 */
function ReplayPlayer({
                          roomCode: initialRoom,
                          initialRecordingId,
                      }: {
    roomCode: string;
    /** Deep-link a specific recording (e.g. from the Day 39 dashboard) instead of defaulting to "latest". */
    initialRecordingId?: string;
}) {
    const { client, connected } = useStompClient();
    const [replayId] = useState(() => "replay-" + Math.random().toString(36).slice(2, 10));

    const [roomCode, setRoomCode] = useState(initialRoom);
    const [speed, setSpeed] = useState(1);
    const [status, setStatus] = useState<Status>("idle");
    const [durationMs, setDurationMs] = useState(0);
    const [positionMs, setPositionMs] = useState(0);
    const [total, setTotal] = useState(0);
    const [applied, setApplied] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [runOutput, setRunOutput] = useState<RunOutput | null>(null);
    const [runningBy, setRunningBy] = useState<string | null>(null);
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [selectedRecording, setSelectedRecording] = useState(initialRecordingId ?? "");   // "" = the room's latest
    const [skipIdle, setSkipIdle] = useState(true);
    const [realDurationMs, setRealDurationMs] = useState(0);
    const [originalMs, setOriginalMs] = useState(0);
    const [gaps, setGaps] = useState<{ positionMs: number; skippedMs: number }[]>([]);
    const [comments, setComments] = useState<{ id: number; authorName: string; comment: string; playOffsetMs: number }[]>([]);
    const [overallFeedback, setOverallFeedback] = useState<{ authorName: string; rating: number | null; comment: string | null }[]>([]);

    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    if (!ydocRef.current) ydocRef.current = new Y.Doc();

    const rafRef = useRef(0);
    const startedRef = useRef(false);
    const scrubbingRef = useRef(false);
    const firstTimestampRef = useRef<number | null>(null);   // real time of event #0, to show original session time
    // Timeline position is extrapolated between server events: position = anchor.pos + elapsed * speed
    const anchorRef = useRef({ pos: 0, wall: Date.now() });

    // ---- drawing the replayed document into Monaco (batched to one update per animation frame) ----
    const renderEditor = useCallback(() => {
        rafRef.current = 0;
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        const ydoc = ydocRef.current;
        const model = editor?.getModel();
        if (!editor || !monaco || !ydoc || !model) return;

        const text = ydoc.getText("monaco").toString();
        if (model.getValue() !== text) model.setValue(text);

        const language = ydoc.getMap<string>("meta").get("language") ?? "python";
        monaco.editor.setModelLanguage(model, language);
    }, []);

    const scheduleRender = useCallback(() => {
        if (!rafRef.current) rafRef.current = requestAnimationFrame(renderEditor);
    }, [renderEditor]);

    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        scheduleRender();
    };

    // ---- applying one recorded event ----
    const applyEvent = useCallback((m: ReplayMessage) => {
        if (m.type === "EDIT" && m.payload) {
            try {
                Y.applyUpdate(ydocRef.current!, fromBase64(m.payload));
                scheduleRender();
            } catch (e) {
                console.warn("Skipping a bad edit event", m.index, e);
            }
        } else if (m.type === "RUN_REQUESTED") {
            setRunningBy(m.userId ?? "someone");
            setRunOutput(null);
        } else if (m.type === "RUN_COMPLETED" && m.payload) {
            try {
                const r = JSON.parse(m.payload);
                setRunningBy(null);
                setRunOutput({
                    userId: m.userId ?? "someone",
                    language: r.language ?? "",
                    stdout: r.stdout ?? "",
                    stderr: r.stderr ?? "",
                    exitCode: r.exitCode ?? 0,
                    timedOut: !!r.timedOut,
                });
            } catch (e) {
                console.warn("Skipping a bad run event", m.index, e);
            }
        }
    }, [scheduleRender]);

    // ---- messages from the server ----
    const handleMessage = useCallback((m: ReplayMessage) => {
        switch (m.kind) {
            case "RECORDINGS":
                setRecordings(m.recordings ?? []);
                break;
            case "STARTED":
                setDurationMs(m.durationMs);
                setTotal(m.total);
                setApplied(0);
                setError(null);
                setRunOutput(null);
                setRunningBy(null);
                setPositionMs(0);
                setRealDurationMs(m.realDurationMs ?? 0);
                setGaps(m.gaps ?? []);
                setComments(m.comments ?? []);
                setOverallFeedback(m.overallFeedback ?? []);
                setOriginalMs(0);
                firstTimestampRef.current = null;
                setStatus("playing");
                anchorRef.current = { pos: 0, wall: Date.now() };
                break;
            case "EVENT":
                applyEvent(m);
                setApplied(m.index + 1);
                if (m.index === 0) firstTimestampRef.current = m.timestamp;
                if (firstTimestampRef.current !== null) setOriginalMs(m.timestamp - firstTimestampRef.current);
                if (!m.instant) {
                    anchorRef.current = { pos: m.playOffsetMs, wall: Date.now() };
                    if (!scrubbingRef.current) setPositionMs(m.playOffsetMs);
                }
                break;
            case "RESET":
                ydocRef.current?.destroy();
                ydocRef.current = new Y.Doc();
                setRunOutput(null);
                setRunningBy(null);
                scheduleRender();
                break;
            case "SEEKED":
                anchorRef.current = { pos: m.positionMs, wall: Date.now() };
                setPositionMs(m.positionMs);
                setStatus((s) => (s === "finished" ? "paused" : s));
                break;
            case "PAUSED":
                anchorRef.current = { pos: m.positionMs, wall: Date.now() };
                setPositionMs(m.positionMs);
                setStatus("paused");
                break;
            case "FINISHED":
                setPositionMs(m.durationMs);
                setStatus("finished");
                break;
            case "ERROR":
                setError(m.message ?? "Replay failed");
                setStatus("error");
                startedRef.current = false;
                break;
            case "STOPPED":
                break;
        }
    }, [applyEvent, scheduleRender]);

    // Subscribe BEFORE sending start so the first messages aren't missed; stop the replay on leave
    useEffect(() => {
        if (!connected || !client) return;

        const subscription = client.subscribe(`/topic/replay/${replayId}`, (frame) => {
            handleMessage(JSON.parse(frame.body) as ReplayMessage);
        });

        return () => {
            subscription.unsubscribe();
            if (startedRef.current && client.connected) {
                client.publish({ destination: `/app/replay/${replayId}/stop`, body: "{}" });
            }
        };
    }, [connected, client, replayId, handleMessage]);

    // While idle, keep the "which recording?" list current for the room being typed in
    useEffect(() => {
        if (!connected || !client || status !== "idle" || !roomCode.trim()) return;
        const timer = setTimeout(() => {
            client.publish({
                destination: `/app/replay/${replayId}/list`,
                body: JSON.stringify({ roomCode }),
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [connected, client, status, roomCode, replayId]);

    // Smooth scrub bar while playing (server only sends a message per recorded event)
    useEffect(() => {
        if (status !== "playing") return;
        const id = setInterval(() => {
            if (scrubbingRef.current) return;
            const a = anchorRef.current;
            setPositionMs(Math.min(a.pos + (Date.now() - a.wall) * speed, durationMs));
        }, 100);
        return () => clearInterval(id);
    }, [status, speed, durationMs]);

    useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

    // ---- controls ----
    const send = (command: string, body: object = {}) => {
        client?.publish({ destination: `/app/replay/${replayId}/${command}`, body: JSON.stringify(body) });
    };

    const onPlayPause = () => {
        if (!connected) return;
        if (status === "idle" || status === "error") {
            startedRef.current = true;
            send("start", {
                roomCode,
                recordingId: selectedRecording || undefined,
                speed,
                maxGapMs: skipIdle ? 3000 : 0,
            });
        } else if (status === "playing") {
            send("pause");
        } else {
            // paused or finished (server restarts a finished replay from the beginning)
            anchorRef.current = { pos: status === "finished" ? 0 : positionMs, wall: Date.now() };
            setStatus("playing");
            send("resume");
        }
    };

    const commitScrub = (e: SyntheticEvent<HTMLInputElement>) => {
        if (!scrubbingRef.current) return;
        scrubbingRef.current = false;
        send("seek", { positionMs: Number(e.currentTarget.value) });
    };

    const onSpeedChange = (newSpeed: number) => {
        if (status === "playing") {
            // re-anchor at the current position so the scrub bar doesn't jump when the speed changes
            const a = anchorRef.current;
            const now = Date.now();
            anchorRef.current = { pos: Math.min(a.pos + (now - a.wall) * speed, durationMs), wall: now };
        }
        setSpeed(newSpeed);
        if (status !== "idle" && status !== "error") send("speed", { speed: newSpeed });
    };

    // Back to the idle state so room / speed / idle-gap setting can be changed and a new replay started
    const onReset = () => {
        if (startedRef.current && client?.connected) send("stop");
        startedRef.current = false;
        ydocRef.current?.destroy();
        ydocRef.current = new Y.Doc();
        scheduleRender();
        setStatus("idle");
        setPositionMs(0);
        setDurationMs(0);
        setTotal(0);
        setApplied(0);
        setRealDurationMs(0);
        setOriginalMs(0);
        setGaps([]);
        setRunOutput(null);
        setRunningBy(null);
        setError(null);
    };

    const buttonLabel = {
        idle: "▶ Play",
        playing: "⏸ Pause",
        paused: "▶ Resume",
        finished: "↻ Replay",
        error: "▶ Retry",
    }[status];

    const started = status !== "idle" && status !== "error";

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#1e1e1e", color: "#fff" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 8px" }}>
                <span>Room:</span>
                <input
                    value={roomCode}
                    onChange={(e) => {
                        setRoomCode(e.target.value);
                        setSelectedRecording("");
                        setRecordings([]);
                    }}
                    disabled={started}
                    style={{ width: 160 }}
                />
                <select
                    value={selectedRecording}
                    onChange={(e) => setSelectedRecording(e.target.value)}
                    disabled={started}
                    title="A room gets a new recording each time everyone leaves and someone comes back"
                >
                    <option value="">Latest recording</option>
                    {recordings.map((r) => (
                        <option key={r.recordingId} value={r.recordingId}>
                            {new Date(r.startedAt).toLocaleString()} - {r.eventCount} events - {formatTime(r.endedAt - r.startedAt)}
                        </option>
                    ))}
                </select>
                <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
                    {SPEEDS.map((s) => (
                        <option key={s} value={s}>{s}x</option>
                    ))}
                </select>
                <label title="Shorten long idle stretches (over 3 s) so the replay doesn't sit still">
                    <input
                        type="checkbox"
                        checked={skipIdle}
                        onChange={(e) => setSkipIdle(e.target.checked)}
                        disabled={started}
                    />{" "}
                    Skip idle gaps
                </label>
                <button onClick={onPlayPause} disabled={!connected || !roomCode.trim()}>
                    {buttonLabel}
                </button>
                {started && <button onClick={onReset}>Reset</button>}
                <span style={{ color: "#888", marginLeft: "auto" }}>
                    {started ? `event ${applied} / ${total}` : connected ? "ready" : "connecting..."}
                </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 8px 6px" }}>
                <span style={{ fontFamily: "monospace" }}>{formatTime(positionMs)}</span>
                <div style={{ flex: 1 }}>
                    {/* one tick per shortened idle stretch; hover for how much time was cut */}
                    <div style={{ position: "relative", height: 8 }}>
                        {durationMs > 0 && gaps.map((g, i) => (
                            <div
                                key={`gap-${i}`}
                                title={`${formatTime(g.skippedMs)} of idle time skipped here`}
                                style={{
                                    position: "absolute",
                                    left: `${(g.positionMs / durationMs) * 100}%`,
                                    top: 0,
                                    width: 6,
                                    height: 8,
                                    marginLeft: -3,
                                    background: "#f9a825",
                                    borderRadius: 1,
                                    cursor: "help",
                                }}
                            />
                        ))}
                        {durationMs > 0 && comments.map((c) => (
                            <div
                                key={`comment-${c.id}`}
                                title={`${c.authorName}: ${c.comment}`}
                                onClick={() => {
                                    scrubbingRef.current = true;
                                    setPositionMs(c.playOffsetMs);
                                    send("seek", { positionMs: c.playOffsetMs });
                                    scrubbingRef.current = false;
                                }}
                                style={{
                                    position: "absolute",
                                    left: `${(c.playOffsetMs / durationMs) * 100}%`,
                                    top: 0,
                                    width: 6,
                                    height: 8,
                                    marginLeft: -3,
                                    background: "#4fc3f7",
                                    borderRadius: "50%",
                                    cursor: "pointer",
                                }}
                            />
                        ))}
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={Math.max(durationMs, 1)}
                        step={10}
                        value={Math.min(positionMs, Math.max(durationMs, 1))}
                        disabled={!started || durationMs === 0}
                        onChange={(e) => {
                            scrubbingRef.current = true;
                            setPositionMs(Number(e.target.value));
                        }}
                        onPointerUp={commitScrub}
                        onKeyUp={commitScrub}
                        style={{ width: "100%", margin: 0 }}
                    />
                </div>
                <span style={{ fontFamily: "monospace" }}>{formatTime(durationMs)}</span>
            </div>

            {started && (
                <div style={{ color: "#888", padding: "0 8px 6px", fontSize: 12 }}>
                    Original session time: {formatTime(originalMs)} / {formatTime(realDurationMs)}
                    {gaps.length > 0 && ` - ${gaps.length} idle gap${gaps.length > 1 ? "s" : ""} shortened (orange marks)`}
                    {comments.length > 0 && ` - ${comments.length} comment${comments.length > 1 ? "s" : ""} (blue marks)`}
                </div>
            )}

            {overallFeedback.length > 0 && (
                <div style={{ padding: "0 8px 6px", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {overallFeedback.map((f, i) => (
                        <div key={i} style={{ fontSize: 12, background: "#252525", padding: "4px 8px", borderRadius: 4 }}>
                            <span style={{ color: "#f9a825" }}>{"\u2605".repeat(f.rating ?? 0)}</span>
                            <span style={{ color: "#555" }}>{"\u2605".repeat(5 - (f.rating ?? 0))}</span>
                            <span style={{ color: "#888", marginLeft: 6 }}>{f.authorName}</span>
                            {f.comment && <div style={{ marginTop: 2 }}>{f.comment}</div>}
                        </div>
                    ))}
                </div>
            )}

            {error && <div style={{ color: "#f9a825", padding: "0 8px 6px" }}>{error}</div>}

            <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    onMount={handleEditorMount}
                    options={{ readOnly: true, minimap: { enabled: false } }}
                />
            </div>

            <div
                style={{
                    height: "30vh",
                    overflow: "auto",
                    padding: 8,
                    borderTop: "1px solid #333",
                    fontFamily: "monospace",
                    fontSize: 13,
                }}
            >
                {runningBy && <div>{runningBy} is running the code...</div>}
                {!runningBy && !runOutput && (
                    <div style={{ color: "#888" }}>Output from runs during the session appears here.</div>
                )}
                {comments.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ color: "#888", marginBottom: 2 }}>Comments</div>
                        {comments.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => send("seek", { positionMs: c.playOffsetMs })}
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    padding: "2px 0",
                                    cursor: "pointer",
                                    opacity: positionMs >= c.playOffsetMs ? 1 : 0.5,
                                }}
                            >
                                <span style={{ color: "#4fc3f7", fontFamily: "monospace", flexShrink: 0 }}>
                                    {formatTime(c.playOffsetMs)}
                                </span>
                                <span style={{ color: "#888", flexShrink: 0 }}>{c.authorName}:</span>
                                <span>{c.comment}</span>
                            </div>
                        ))}
                    </div>
                )}
                {runOutput && (
                    <>
                        <div style={{ color: "#888" }}>
                            {runOutput.language} - run by {runOutput.userId}
                        </div>
                        {runOutput.stdout && <pre style={{ margin: 0 }}>{runOutput.stdout}</pre>}
                        {runOutput.stderr && <pre style={{ margin: 0, color: "#f48771" }}>{runOutput.stderr}</pre>}
                        <div style={{ color: runOutput.exitCode === 0 ? "#4caf50" : "#f48771" }}>
                            {runOutput.timedOut ? "Timed out" : `Exited with code ${runOutput.exitCode}`}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default ReplayPlayer;