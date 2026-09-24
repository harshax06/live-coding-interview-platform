import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api";
import NavBar from "./NavBar.tsx";

function SignupPage() {
    const { signup } = useAuth();
    const navigate = useNavigate();

    const [role, setRole] = useState<"INTERVIEWER" | "CANDIDATE">("INTERVIEWER");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await signup(email, password, name, role);
            navigate(role === "INTERVIEWER" ? "/dashboard" : "/", { replace: true });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="page">
            <NavBar />
            <div className="container-narrow" style={{ paddingTop: 60 }}>
                <h2 style={{ marginBottom: 20 }}>Sign up</h2>
                <form onSubmit={submit} className="card">
                    <div className="field">
                        <label className="label">I am a...</label>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                type="button"
                                className={`btn btn-block ${role === "INTERVIEWER" ? "btn-primary" : ""}`}
                                onClick={() => setRole("INTERVIEWER")}
                            >
                                Interviewer
                            </button>
                            <button
                                type="button"
                                className={`btn btn-block ${role === "CANDIDATE" ? "btn-primary" : ""}`}
                                onClick={() => setRole("CANDIDATE")}
                            >
                                Candidate
                            </button>
                        </div>
                    </div>
                    <div className="field">
                        <label className="label">Name</label>
                        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label className="label">Email</label>
                        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label className="label">Password</label>
                        <input
                            className="input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                            required
                        />
                    </div>
                    {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
                    <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                        {busy ? "Creating account..." : "Sign up"}
                    </button>
                </form>
                <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                    Already have an account? <Link to="/login" className="link">Log in</Link>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;