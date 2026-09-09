import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";

function App({ roomJoinCode = "default-room" }: { roomJoinCode?: string }) {
    const bindingRef = useRef<{
        binding: MonacoBinding;
        provider: WebsocketProvider;
        ydoc: Y.Doc;
    } | null>(null);

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

    useEffect(() => {
        return () => {
            bindingRef.current?.binding.destroy();
            bindingRef.current?.provider.destroy();
            bindingRef.current?.ydoc.destroy();

            bindingRef.current = null;
        };
    }, []);

    return (
        <Editor
            height="100vh"
            defaultLanguage="javascript"
            theme="vs-dark"
            onMount={handleEditorMount}
        />
    );
}

export default App;