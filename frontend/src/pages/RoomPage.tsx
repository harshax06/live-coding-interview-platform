import { useParams } from "react-router-dom";
import App from "../App";

// Thin adapter: route param -> App's existing roomJoinCode prop, unchanged since Day 19.
function RoomPage() {
    const { joinCode } = useParams<{ joinCode: string }>();
    return <App roomJoinCode={joinCode} />;
}

export default RoomPage;