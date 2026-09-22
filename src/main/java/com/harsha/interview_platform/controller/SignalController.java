package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.SignalRequest;
import com.harsha.interview_platform.dto.response.SignalMessage;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

/**
 * Pure relay for WebRTC signaling: the server never looks at SDP or ICE candidate content,
 * it only stamps who sent a message and rebroadcasts it to the room's topic.
 *
 * Every client in a room subscribes to ONE topic, /topic/signal/{roomCode}, and filters
 * messages client-side by toUserId - simpler than per-user queues, and fine at interview-room
 * scale (a handful of participants). offer/answer/ice-candidate are always addressed to one
 * peer (toUserId required); presence-driven "who do I call" is handled on the frontend (Day 28).
 */
@Controller
public class SignalController {

    private static final int MAX_PAYLOAD_CHARS = 20_000; // generous for SDP; guards against abuse

    private final SimpMessagingTemplate messagingTemplate;

    public SignalController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/signal/{roomCode}")
    public void relay(@DestinationVariable String roomCode, SignalRequest request) {
        if (!isValid(request)) return;

        SignalMessage message = new SignalMessage(
                request.getType(), request.getFromUserId(), request.getToUserId(), request.getPayload());

        messagingTemplate.convertAndSend("/topic/signal/" + roomCode, message);
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