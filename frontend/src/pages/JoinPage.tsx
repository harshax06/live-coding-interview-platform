import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveRoom, ApiError, type RoomInfo } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import NavBar from "./NavBar.tsx";

function JoinPage() {
    const { joinCode } = useParams<{ joinCode: string }>();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [room, setRoom] = useState<RoomInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token || !joinCode) return;
        setLoading(true);
        resolveRoom(token, joinCode)
            .then(setRoom)
            .catch((e) => setError(e instanceof ApiError && e.status === 404
                ? "This session link isn't valid - check it with your interviewer."
                : "Could not look up this session"))
            .finally(() => setLoading(false));
    }, [token, joinCode]);

    return (
        <div className="page">
            <NavBar />
            <div className="container-narrow" style={{ paddingTop: 60 }}>
                {loading && <div className="muted">Checking session link...</div>}
                {error && <div className="error-text">{error}</div>}
                {room && (
                    <div className="card" style={{ textAlign: "center" }}>
                        <div className="muted" style={{ marginBottom: 6 }}>Session hosted by</div>
                        <div style={{ fontWeight: "bold", fontSize: 18, marginBottom: 20 }}>{room.createdByName}</div>
                        <button className="btn btn-primary btn-block" onClick={() => navigate(`/room/${room.joinCode}`)}>
                            Join session
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default JoinPage;