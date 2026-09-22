import { useEffect, useRef, useState } from "react";
import type { Client } from "@stomp/stompjs";
import { useWebRTC } from "./hooks/useWebRTC";

interface VideoCallProps {
    client: Client | null;
    connected: boolean;
    roomCode: string;
    userId: string;
    /** Everyone currently in the room, including this tab's own userId (from your presence topic). */
    onlineUsers: string[];
}

type MediaStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable";

/**
 * Local camera/mic capture + rendering of both video streams. WebRTC signaling itself
 * lives in useWebRTC (Day 27) - this component decides WHO to call (presence) and WHAT
 * to show (the two <video> elements, mic/camera toggle, connection status).
 *
 * Two-person calls only for now: the first other user id in the room (sorted, so both
 * tabs agree) becomes remoteUserId. A third participant in the room simply isn't called -
 * Week 6 doesn't ask for group video, and useWebRTC's "one peer per hook instance" design
 * would need a rework (one RTCPeerConnection per peer) to support more.
 */
function VideoCall({ client, connected, roomCode, userId, onlineUsers }: VideoCallProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [mediaStatus, setMediaStatus] = useState<MediaStatus>("idle");
    const [micOn, setMicOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(true);

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

    const remoteUserId = onlineUsers.filter((id) => id !== userId).sort()[0] ?? null;

    const { remoteStream, connectionState } = useWebRTC({
        client,
        connected,
        roomCode,
        userId,
        remoteUserId,
        localStream,
    });

    // Ask for camera/mic once. getUserMedia needs a secure context - fine on localhost, needs
    // HTTPS once this is deployed (Week 9).
    useEffect(() => {
        let cancelled = false;
        setMediaStatus("requesting");

        navigator.mediaDevices
            ?.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                setLocalStream(stream);
                setMediaStatus("ready");
            })
            .catch((err: DOMException) => {
                if (cancelled) return;
                console.warn("getUserMedia failed:", err.name, err.message);
                setMediaStatus(err.name === "NotFoundError" ? "unavailable" : "denied");
            });

        if (!navigator.mediaDevices) setMediaStatus("unavailable");

        return () => {
            cancelled = true;
        };
    }, []);

    // Release the camera/mic light when this component unmounts (leaving the room)
    useEffect(() => {
        return () => {
            localStream?.getTracks().forEach((t) => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localStream]);

    useEffect(() => {
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    }, [remoteStream]);

    const toggleMic = () => {
        localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
        setMicOn(!micOn);
    };

    const toggleCamera = () => {
        localStream?.getVideoTracks().forEach((t) => (t.enabled = !cameraOn));
        setCameraOn(!cameraOn);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, background: "#252525" }}>
            <div style={{ display: "flex", gap: 8 }}>
                <VideoTile
                    videoRef={localVideoRef}
                    muted
                    label="You"
                    placeholder={mediaStatusLabel(mediaStatus)}
                    cameraOff={!cameraOn}
                />
                <VideoTile
                    videoRef={remoteVideoRef}
                    muted={false}
                    label={remoteUserId ?? "Waiting for someone to join..."}
                    placeholder={remoteUserId ? connectionStateLabel(connectionState) : "Nobody else here yet"}
                    cameraOff={!remoteStream}
                />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={toggleMic} disabled={mediaStatus !== "ready"}>
                    {micOn ? "Mute mic" : "Unmute mic"}
                </button>
                <button onClick={toggleCamera} disabled={mediaStatus !== "ready"}>
                    {cameraOn ? "Turn camera off" : "Turn camera on"}
                </button>
                {mediaStatus === "denied" && (
                    <span style={{ color: "#f48771", alignSelf: "center" }}>
                        Camera/mic permission was denied - allow it in the browser's site settings and reload.
                    </span>
                )}
                {mediaStatus === "unavailable" && (
                    <span style={{ color: "#f9a825", alignSelf: "center" }}>
                        No camera or microphone found on this device.
                    </span>
                )}
            </div>
        </div>
    );
}

function mediaStatusLabel(status: MediaStatus): string {
    switch (status) {
        case "requesting": return "Requesting camera...";
        case "denied": return "Camera/mic blocked";
        case "unavailable": return "No camera found";
        default: return "";
    }
}

function connectionStateLabel(state: string): string {
    switch (state) {
        case "connecting": return "Connecting...";
        case "connected": return "";
        case "disconnected": return "Reconnecting...";
        case "failed": return "Connection failed";
        case "closed": return "Call ended";
        default: return "Connecting...";
    }
}

function VideoTile({
                       videoRef,
                       muted,
                       label,
                       placeholder,
                       cameraOff,
                   }: {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    muted: boolean;
    label: string;
    placeholder: string;
    cameraOff: boolean;
}) {
    return (
        <div style={{ position: "relative", width: 200, height: 150, background: "#111", borderRadius: 6, overflow: "hidden" }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: cameraOff ? "none" : "block",
                    transform: muted ? "scaleX(-1)" : undefined, // mirror only the local ("You") tile
                }}
            />
            {cameraOff && (
                <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center",
                    justifyContent: "center", color: "#888", fontSize: 12, textAlign: "center", padding: 8,
                }}>
                    {placeholder}
                </div>
            )}
            <span style={{
                position: "absolute", bottom: 4, left: 6, fontSize: 11,
                color: "#fff", textShadow: "0 1px 2px #000",
            }}>
                {label}
            </span>
        </div>
    );
}

export default VideoCall;