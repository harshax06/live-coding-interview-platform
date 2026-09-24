import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "./NavBar";

function Landing() {
    const { user } = useAuth();

    return (
        <div className="page">
            <NavBar />
            <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
                <h1 style={{ fontSize: 32, marginBottom: 12 }}>Run live coding interviews</h1>
                <p className="muted" style={{ fontSize: 16, marginBottom: 28 }}>
                    A shared editor, code execution in five languages, video, and full session replay.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    {!user && (
                        <>
                            <Link to="/signup" className="btn btn-primary">Get started</Link>
                            <Link to="/login" className="btn">Log in</Link>
                        </>
                    )}
                    {user?.role === "INTERVIEWER" && (
                        <Link to="/rooms/new" className="btn btn-primary">Create a session</Link>
                    )}
                    {user?.role === "CANDIDATE" && (
                        <span className="muted">Ask your interviewer for a session link to join.</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Landing;