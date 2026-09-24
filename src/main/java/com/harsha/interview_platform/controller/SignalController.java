package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.config.RedisBroadcaster;
import com.harsha.interview_platform.dto.request.SignalRequest;
import com.harsha.interview_platform.dto.response.SignalMessage;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

/**
 * Pure relay for WebRTC signaling, now cluster-wide via Redis pub/sub (RedisBroadcaster):
 * the two peers in a call can each be connected to a different backend instance, since
 * sticky sessions only guarantee one client always reaches the SAME instance, not that two
 * different clients reach the same instance as each other.
 */
@Controller
public class SignalController {

    private static final int MAX_PAYLOAD_CHARS = 20_000; // generous for SDP; guards against abuse

    private final RedisBroadcaster broadcaster;

    public SignalController(RedisBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @MessageMapping("/signal/{roomCode}")
    public void relay(@DestinationVariable String roomCode, SignalRequest request) {
        if (!isValid(request)) return;

        SignalMessage message = new SignalMessage(
                request.getType(), request.getFromUserId(), request.getToUserId(), request.getPayload());

        broadcaster.publish("/topic/signal/" + roomCode, message);
    }

    private boolean isValid(SignalRequest r) {
        if (r.getFromUserId() == null || r.getFromUserId().isBlank()) return false;
        if (r.getToUserId() == null || r.getToUserId().isBlank()) return false;
        if (r.getType() == null) return false;
        return switch (r.getType()) {
            case "offer", "answer", "ice-candidate" -> r.getPayload() != null
                    && r.getPayload().toString().length() <= MAX_PAYLOAD_CHARS;
            default -> false;
        };
    }
}