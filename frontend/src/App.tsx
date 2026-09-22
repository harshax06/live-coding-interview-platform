import { useCallback, useEffect, useRef, useState } from "react";
import VideoCall from "./VideoCall";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { useStompClient } from "./hooks/useStompClient";

type RunEvent = {
    status: "RUNNING" | "DONE" | "REJECTED";
    requestedBy: string;
    language: string | null;
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    message: string | null;
};

// Yjs updates are binary; STOMP/JSON needs text
function toBase64(bytes: Uint8Array): string {
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
}

// ids match both Monaco's language ids and the backend Languages registry
const LANGUAGES = ["python", "javascript", "java", "cpp", "c"];

function App({ roomJoinCode = "default-room" }: { roomJoinCode?: string }) {
    const bindingRef = useRef<{
        binding: MonacoBinding;
        provider: WebsocketProvider;
        ydoc: Y.Doc;
    } | null>(null);
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const metaRef = useRef<Y.Map<string> | null>(null);

    const { client, connected } = useStompClient();
    // The Yjs listener is created once at editor mount, so it reads the live client through a ref
    const clientRef = useRef<typeof client>(null);
    useEffect(() => {
        clientRef.current = connected ? client : null;
    }, [client, connected]);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    // stable per tab (previously regenerated inside the presence effect)
    const [userId] = useState(() => "user-" + Math.floor(Math.random() * 1000));

    // --- recording: which document lifetime (Yjs lineage) do these edits belong to? ---
    // The id lives inside the Yjs document (meta map), so everyone in the room shares it, and a room whose
    // document is gone (everyone left) starts a NEW recording instead of mixing into the old one.
    const recordingIdRef = useRef<string | null>(null);
    const pendingEditsRef = useRef<string[]>([]);

    // Sends queued edits once both the STOMP connection and the recording id are known (keeps order)
    const flushPendingEdits = useCallback(() => {
        const stomp = clientRef.current;
        const recordingId = recordingIdRef.current;
        if (!stomp || !recordingId) return;
        for (const update of pendingEditsRef.current.splice(0)) {
            stomp.publish({
                destination: `/app/events/${roomJoinCode}/edit`,
                body: JSON.stringify({ userId, recordingId, update }),
            });
        }
    }, [roomJoinCode, userId]);

    useEffect(() => {
        flushPendingEdits();
    }, [connected, client, flushPendingEdits]);

    const [language, setLanguage] = useState("python");
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<RunEvent | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        const model = editor.getModel();

        if (!model) {
            console.error("Monaco editor model is not available.");
            return;
        }

        const ydoc = new Y.Doc();

        const provider = new WebsocketProvider(
            "ws://localhost:1234",
            roomJoinCode,
            ydoc
        );

        provider.on("status", (event) => {
            console.log("Yjs WebSocket status:", event.status);
        });

        const ytext = ydoc.getText("monaco");

        const binding = new MonacoBinding(
            ytext,
            model,
            new Set([editor]),
            provider.awareness
        );

        // Report this user's own edits to the backend event log (Kafka).
        // Updates that arrive from other users have origin === provider, so they are skipped:
        // every edit is published exactly once, by the person who typed it.
        ydoc.on("update", (update: Uint8Array, origin: unknown) => {
            if (origin === provider) return;
            pendingEditsRef.current.push(toBase64(update));
            flushPendingEdits();
        });

        // First one into a fresh document creates the recording id; everyone joining later reads it.
        const meta = ydoc.getMap<string>("meta");
        provider.on("sync", (isSynced: boolean) => {
            if (!isSynced) return;
            let id = meta.get("recordingId");
            if (!id) {
                id = crypto.randomUUID();
                recordingIdRef.current = id;        // set BEFORE writing, so this very update is logged under it
                meta.set("recordingId", id);
            } else {
                recordingIdRef.current = id;
            }
            flushPendingEdits();
        });

        // Selected language is shared through Yjs so both clients always run the same thing
        meta.observe(() => {
            const lang = meta.get("language") ?? "python";
            setLanguage(lang);
            monaco.editor.setModelLanguage(model, lang);
            const id = meta.get("recordingId");
            if (id) recordingIdRef.current = id;   // if two people created ids at once, everyone converges on one
        });
        metaRef.current = meta;
        monaco.editor.setModelLanguage(model, "python");

        bindingRef.current = { binding, provider, ydoc };
    };

    const handleLanguageChange = (lang: string) => {
        metaRef.current?.set("language", lang);
    };

    // Yjs cleanup on unmount
    useEffect(() => {
        return () => {
            bindingRef.current?.binding.destroy();
            bindingRef.current?.provider.destroy();
            bindingRef.current?.ydoc.destroy();
            bindingRef.current = null;
        };
    }, []);

    // Presence: join room + subscribe to updates over STOMP
    useEffect(() => {
        if (!connected || !client) return;

        client.publish({
            destination: "/app/presence/join",
            body: JSON.stringify({ roomCode: roomJoinCode, userId }),
        });

        const subscription = client.subscribe(
            `/topic/presence/${roomJoinCode}`,
            (message) => {
                setOnlineUsers(JSON.parse(message.body));
            }
        );

        return () => subscription.unsubscribe();
    }, [connected, client, roomJoinCode, userId]);

    // Run results: everyone in the room receives every event
    useEffect(() => {
        if (!connected || !client) return;

        const subscription = client.subscribe(
            `/topic/run/${roomJoinCode}`,
            (message) => {
                const event: RunEvent = JSON.parse(message.body);

                if (event.status === "RUNNING") {
                    setRunning(true);
                    setResult(null);
                    setNotice(null);
                } else if (event.status === "DONE") {
                    setRunning(false);
                    setResult(event);
                } else if (event.status === "REJECTED") {
                    // only the person who clicked Run needs to see the reason
                    if (event.requestedBy === userId) setNotice(event.message);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [connected, client, roomJoinCode, userId]);

    const handleRun = () => {
        if (!client || !connected || running) return;
        const code = editorRef.current?.getValue() ?? "";

        setNotice(null);
        client.publish({
            destination: `/app/run/${roomJoinCode}`,
            body: JSON.stringify({ language, code, userId, recordingId: recordingIdRef.current }),
        });
    };

    return (
        <div
            style={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                background: "#1e1e1e",
                color: "#fff",
            }}
        >
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 8px" }}>
                <span style={{ flex: 1 }}>
                    Online: {onlineUsers.join(", ") || "none yet"}
                </span>
                <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={running}
                >
                    {LANGUAGES.map((l) => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                </select>
                <button onClick={handleRun} disabled={!connected || running}>
                    {running ? "Running..." : "Run"}
                </button>
            </div>

            <VideoCall
                client={client}
                connected={connected}
                roomCode={roomJoinCode}
                userId={userId}
                onlineUsers={onlineUsers}
            />

            <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    onMount={handleEditorMount}
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
                {notice && <div style={{ color: "#f9a825" }}>{notice}</div>}
                {running && <div>Running...</div>}
                {!running && !result && !notice && (
                    <div style={{ color: "#888" }}>Output will appear here for everyone in the room.</div>
                )}
                {result && (
                    <>
                        <div style={{ color: "#888" }}>
                            {result.language} - run by {result.requestedBy}
                        </div>
                        {result.stdout && <pre style={{ margin: 0 }}>{result.stdout}</pre>}
                        {result.stderr && (
                            <pre style={{ margin: 0, color: "#f48771" }}>{result.stderr}</pre>
                        )}
                        <div style={{ color: result.exitCode === 0 ? "#4caf50" : "#f48771" }}>
                            {result.timedOut
                                ? "Timed out"
                                : `Exited with code ${result.exitCode}`}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default App;