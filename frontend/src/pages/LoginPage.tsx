import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../lib/api";
import NavBar from "./NavBar.tsx";

function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await login(email, password);
            navigate(from, { replace: true });
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
                <h2 style={{ marginBottom: 20 }}>Log in</h2>
                <form onSubmit={submit} className="card">
                    <div className="field">
                        <label className="label">Email</label>
                        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label className="label">Password</label>
                        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
                    <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                        {busy ? "Logging in..." : "Log in"}
                    </button>
                </form>
                <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                    No account? <Link to="/signup" className="link">Sign up</Link>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;