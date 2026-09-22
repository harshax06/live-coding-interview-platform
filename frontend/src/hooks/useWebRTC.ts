import { useCallback, useEffect, useRef, useState } from "react";
import type { Client } from "@stomp/stompjs";

// Free public STUN server - fine for local/LAN testing (Day 29). A TURN server is a
// later, deployment-time addition for peers that can't reach each other directly.
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type SignalMessage = {
    type: "offer" | "answer" | "ice-candidate";
    fromUserId: string;
    toUserId: string;
    payload: unknown;
};

export type PeerConnectionState = "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";

interface UseWebRTCOptions {
    client: Client | null;
    connected: boolean;
    roomCode: string;
    userId: string;
    /** The other participant's id. WebRTC here is always exactly two peers per room (Day 28 UI). */
    remoteUserId: string | null;
    localStream: MediaStream | null;
    /** Bump this (e.g. on a "Retry call" click) to tear down and rebuild the peer connection. */
    resetKey?: number;
}

/**
 * One RTCPeerConnection to `remoteUserId`, signaled over the existing STOMP connection.
 * The lower userId always makes the offer - avoids both sides racing to call each other
 * (a "glare" condition) without needing any extra coordination.
 */
export function useWebRTC({ client, connected, roomCode, userId, remoteUserId, localStream, resetKey = 0 }: UseWebRTCOptions) {
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionState, setConnectionState] = useState<PeerConnectionState>("new");

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]); // ICE that arrives before remoteDescription is set

    const sendSignal = useCallback((toUserId: string, type: SignalMessage["type"], payload: unknown) => {
        client?.publish({
            destination: `/app/signal/${roomCode}`,
            body: JSON.stringify({ type, fromUserId: userId, toUserId, payload }),
        });
    }, [client, roomCode, userId]);

    const teardown = useCallback(() => {
        pcRef.current?.close();
        pcRef.current = null;
        queuedCandidatesRef.current = [];
        setRemoteStream(null);
        setConnectionState("closed");
    }, []);

    const ensurePeerConnection = useCallback(() => {
        if (pcRef.current || !remoteUserId) return pcRef.current;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                // candidate.type: "host" (direct), "srflx" (via STUN), "relay" (via TURN) -
                // seeing only "host" candidates from both sides is the #1 reason two tabs on
                // the SAME machine/LAN still connect even with no TURN server configured
                console.log(`[webrtc] local candidate: ${event.candidate.type} ${event.candidate.protocol}`);
                sendSignal(remoteUserId, "ice-candidate", event.candidate.toJSON());
            } else {
                console.log("[webrtc] ICE gathering complete");
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream((prev) => prev ?? event.streams[0] ?? new MediaStream([event.track]));
        };

        pc.onconnectionstatechange = () => {
            console.log(`[webrtc] connectionState -> ${pc.connectionState}`);
            setConnectionState(pc.connectionState as PeerConnectionState);
        };

        // connectionState alone often stays "connecting" while the real story is in ICE -
        // these two are what you want in the console when a call won't connect
        pc.oniceconnectionstatechange = () => {
            console.log(`[webrtc] iceConnectionState -> ${pc.iceConnectionState}`);
        };
        pc.onicegatheringstatechange = () => {
            console.log(`[webrtc] iceGatheringState -> ${pc.iceGatheringState}`);
        };
        pc.onsignalingstatechange = () => {
            console.log(`[webrtc] signalingState -> ${pc.signalingState}`);
        };

        localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

        return pc;
    }, [remoteUserId, localStream, sendSignal]);

    // Deterministic caller: lower userId always offers, so both tabs never call each other at once
    const isCaller = !!(remoteUserId && userId < remoteUserId);

    const startCall = useCallback(async () => {
        if (!remoteUserId) return;
        const pc = ensurePeerConnection();
        if (!pc) return;
        console.log(`[webrtc] creating offer for ${remoteUserId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(remoteUserId, "offer", offer);
    }, [remoteUserId, ensurePeerConnection, sendSignal]);

    useEffect(() => {
        if (!connected || !client || !remoteUserId) return;

        const subscription = client.subscribe(`/topic/signal/${roomCode}`, async (frame) => {
            const msg = JSON.parse(frame.body) as SignalMessage;
            if (msg.toUserId !== userId || msg.fromUserId !== remoteUserId) return; // not for this pair

            const pc = ensurePeerConnection();
            if (!pc) return;

            console.log(`[webrtc] received ${msg.type} from ${msg.fromUserId}`);

            if (msg.type === "offer") {
                await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
                for (const c of queuedCandidatesRef.current.splice(0)) await pc.addIceCandidate(c);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(remoteUserId, "answer", answer);
            } else if (msg.type === "answer") {
                await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
                for (const c of queuedCandidatesRef.current.splice(0)) await pc.addIceCandidate(c);
            } else if (msg.type === "ice-candidate") {
                const candidate = msg.payload as RTCIceCandidateInit;
                // Candidates can arrive before the offer/answer is set (trickle ICE) - queue until ready
                if (pc.remoteDescription) await pc.addIceCandidate(candidate);
                else queuedCandidatesRef.current.push(candidate);
            }
        });

        // The offering side kicks things off once both are subscribed and ready
        if (isCaller) startCall();

        return () => {
            subscription.unsubscribe();
            teardown();
        };
        // resetKey is intentionally a dependency: bumping it (a manual retry) re-runs this
        // effect, which tears down the old RTCPeerConnection and starts a fresh offer/answer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, client, roomCode, userId, remoteUserId, resetKey]);

    // Local stream can arrive after the peer connection already exists (camera permission was slow)
    useEffect(() => {
        const pc = pcRef.current;
        if (!pc || !localStream) return;
        const senderTracks = new Set(pc.getSenders().map((s) => s.track));
        localStream.getTracks().forEach((track) => {
            if (!senderTracks.has(track)) pc.addTrack(track, localStream);
        });
    }, [localStream]);

    return { remoteStream, connectionState, isCaller };
}