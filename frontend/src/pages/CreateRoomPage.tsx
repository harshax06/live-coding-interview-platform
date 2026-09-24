import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createRoom, listMyRooms, ApiError, type RoomInfo } from "../lib/api";
import NavBar from "./NavBar.tsx";

function CreateRoomPage() {
    const { token } = useAuth();
    const [room, setRoom] = useState<RoomInfo | null>(null);
    const [recent, setRecent] = useState<RoomInfo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    const loadRecent = () => {
        if (!token) return;
        listMyRooms(token).then(setRecent).catch(() => {});
    };

    useEffect(loadRecent, [token]);

    const handleCreate = async () => {
        if (!token) return;
        setBusy(true);
        setError(null);
        setCopied(false);
        try {
            const created = await createRoom(token);
            setRoom(created);
            loadRecent();
        } catch (e) {
            setError(e instanceof ApiError ? e.message : "Could not create a room");
        } finally {
            setBusy(false);
        }
    };

    const joinLink = room ? `${window.location.origin}/join/${room.joinCode}` : "";

    const copyLink = () => {
        navigator.clipboard.writeText(joinLink).then(() => setCopied(true));
    };

    return (
        <div className="page">
            <NavBar />
            <div className="container" style={{ paddingTop: 40, maxWidth: 640 }}>
                <h2 style={{ marginBottom: 16 }}>New session</h2>

                {!room ? (
                    <div className="card">
                        <p className="muted" style={{ marginBottom: 16 }}>
                            Creates a room with a unique link. Share it with the candidate - they'll
                            need to log in too before joining.
                        </p>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
                            {busy ? "Creating..." : "Create room"}
                        </button>
                        {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
                    </div>
                ) : (
                    <div className="card">
                        <div className="label">Share this link with the candidate</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            <input className="input" readOnly value={joinLink} onFocus={(e) => e.target.select()} />
                            <button className="btn" onClick={copyLink}>{copied ? "Copied" : "Copy"}</button>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <Link to={`/room/${room.joinCode}`} className="btn btn-primary">Enter room now</Link>
                            <button className="btn" onClick={handleCreate} disabled={busy}>
                                Create another
                            </button>
                        </div>
                    </div>
                )}

                {recent.length > 0 && (
                    <div style={{ marginTop: 28 }}>
                        <div className="label" style={{ marginBottom: 10 }}>Your recent rooms</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {recent.map((r) => (
                                <div key={r.joinCode} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: "bold" }}>{r.joinCode}</div>
                                        <div className="faint" style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleString()}</div>
                                    </div>
                                    <Link to={`/room/${r.joinCode}`} className="btn btn-sm">Enter</Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CreateRoomPage;