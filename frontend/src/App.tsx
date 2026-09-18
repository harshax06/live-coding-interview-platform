import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { useStompClient } from "./hooks/useStompClient";

function App({ roomJoinCode = "default-room" }: { roomJoinCode?: string }) {
    const bindingRef = useRef<{
        binding: MonacoBinding;
        provider: WebsocketProvider;
        ydoc: Y.Doc;
    } | null>(null);

    const { client, connected } = useStompClient();
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    const handleEditorMount: OnMount = (editor) => {
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

        bindingRef.current = {
            binding,
            provider,
            ydoc,
        };
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

        const userId = "user-" + Math.floor(Math.random() * 1000);

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
    }, [connected, client, roomJoinCode]);

    return (
        <div style={{ height: "100vh" }}>
            <p style={{ margin: "4px 8px", color: "#fff", background: "#1e1e1e" }}>
                Online: {onlineUsers.join(", ") || "none yet"}
            </p>
            <Editor
                height="calc(100vh - 32px)"
                defaultLanguage="javascript"
                theme="vs-dark"
                onMount={handleEditorMount}
            />
        </div>
    );
}

export default App;