import { useParams, useSearchParams } from "react-router-dom";
import ReplayPlayer from "../ReplayPlayer";

// Thin adapter: route params -> ReplayPlayer's existing props, unchanged since Day 25/39.
function ReplayPage() {
    const { joinCode } = useParams<{ joinCode: string }>();
    const [searchParams] = useSearchParams();
    if (!joinCode) return null;
    return <ReplayPlayer roomCode={joinCode} initialRecordingId={searchParams.get("recordingId") ?? undefined} />;
}

export default ReplayPage;