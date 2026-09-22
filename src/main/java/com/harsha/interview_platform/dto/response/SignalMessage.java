package com.harsha.interview_platform.dto.response;

/**
 * A signaling message relayed to everyone else in a room over /topic/signal/{roomCode}.
 * Payload is opaque JSON (an SDP offer/answer or an ICE candidate) - the server never
 * inspects it, only stamps who sent it and rebroadcasts it.
 */
public class SignalMessage {

    private final String type;      // "offer" | "answer" | "ice-candidate" | "peer-left"
    private final String fromUserId;
    private final String toUserId;  // null = broadcast to the room; set = meant for one peer only
    private final Object payload;   // SDP or ICE candidate JSON, or null for peer-left

    public SignalMessage(String type, String fromUserId, String toUserId, Object payload) {
        this.type = type;
        this.fromUserId = fromUserId;
        this.toUserId = toUserId;
        this.payload = payload;
    }

    public String getType() { return type; }
    public String getFromUserId() { return fromUserId; }
    public String getToUserId() { return toUserId; }
    public Object getPayload() { return payload; }
}