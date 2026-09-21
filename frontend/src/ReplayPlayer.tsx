import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { useStompClient } from "./hooks/useStompClient";

type ReplayMessage = {
    kind: "STARTED" | "EVENT" | "RESET" | "SEEKED" | "PAUSED" | "FINISHED" | "STOPPED" | "ERROR";
    index: number;
    total: number;
    type: string | null;
    userId: string | null;
    playOffsetMs: number;
    durationMs: number;
    positionMs: number;
    payload: string | null;
    instant: boolean;
    message: string | null;
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
function ReplayPlayer({ roomCode: initialRoom }: { roomCode: string }) {
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

    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    if (!ydocRef.current) ydocRef.current = new Y.Doc();

    const rafRef = useRef(0);
    const startedRef = useRef(false);
    const scrubbingRef = useRef(false);
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
            case "STARTED":
                setDurationMs(m.durationMs);
                setTotal(m.total);
                setApplied(0);
                setError(null);
                setRunOutput(null);
                setRunningBy(null);
                setPositionMs(0);
                setStatus("playing");
                anchorRef.current = { pos: 0, wall: Date.now() };
                break;
            case "EVENT":
                applyEvent(m);
                setApplied(m.index + 1);
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
            send("start", { roomCode, speed, maxGapMs: 3000 });
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
                    onChange={(e) => setRoomCode(e.target.value)}
                    disabled={started}
                    style={{ width: 160 }}
                />
                <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} disabled={started}>
                    {SPEEDS.map((s) => (
                        <option key={s} value={s}>{s}x</option>
                    ))}
                </select>
                <button onClick={onPlayPause} disabled={!connected || !roomCode.trim()}>
                    {buttonLabel}
                </button>
                <span style={{ color: "#888", marginLeft: "auto" }}>
                    {started ? `event ${applied} / ${total}` : connected ? "ready" : "connecting..."}
                </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 8px 6px" }}>
                <span style={{ fontFamily: "monospace" }}>{formatTime(positionMs)}</span>
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
                    style={{ flex: 1 }}
                />
                <span style={{ fontFamily: "monospace" }}>{formatTime(durationMs)}</span>
            </div>

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