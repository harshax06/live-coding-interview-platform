import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import NavBar from "./NavBar.tsx";

/**
 * Gate for any route needing a signed-in user. `role` narrows it further (e.g. the
 * dashboard and room-creation pages are interviewer-only) - a signed-in user with the
 * wrong role sees a plain message rather than being bounced back to login.
 */
function ProtectedRoute({ role }: { role?: "INTERVIEWER" | "CANDIDATE" }) {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }
    if (role && user.role !== role) {
        return (
            <div className="page">
                <NavBar />
                <div className="container" style={{ paddingTop: 40 }}>
                    <div className="muted">
                        This page is only available to {role === "INTERVIEWER" ? "interviewers" : "candidates"}.
                    </div>
                </div>
            </div>
        );
    }
    return <Outlet />;
}

export default ProtectedRoute;