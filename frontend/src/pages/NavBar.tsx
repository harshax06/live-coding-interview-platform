import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";

function NavBar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="navbar">
            <Link to="/" className="navbar-brand">Interview Platform</Link>
            <div className="navbar-links">
                {user?.role === "INTERVIEWER" && (
                    <>
                        <Link to="/dashboard">Dashboard</Link>
                        <Link to="/rooms/new">New session</Link>
                    </>
                )}
                {user ? (
                    <>
                        <span className="muted" style={{ fontSize: 13 }}>{user.email}</span>
                        <button
                            className="btn btn-sm"
                            onClick={() => { logout(); navigate("/"); }}
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Log in</Link>
                        <Link to="/signup" className="btn btn-sm btn-primary">Sign up</Link>
                    </>
                )}
            </div>
        </div>
    );
}

export default NavBar;