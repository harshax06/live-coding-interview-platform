package com.harsha.interview_platform.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper; // Jackson 3 (Boot 4); if unresolved use com.fasterxml.jackson.databind's equivalents

/**
 * Fires on EVERY instance (the publisher included) whenever anything is published to
 * RedisBroadcaster's channel. Forwards the payload to this instance's own locally-connected
 * STOMP sessions - the second half of the fan-out PresenceRedisListener already does for
 * presence specifically, generalized to any destination.
 */
@Component
public class BroadcastRedisListener {

    private static final Logger log = LoggerFactory.getLogger(BroadcastRedisListener.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public BroadcastRedisListener(SimpMessagingTemplate messagingTemplate, ObjectMapper objectMapper) {
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    public void handleMessage(String envelopeJson) {
        try {
            JsonNode envelope = objectMapper.readTree(envelopeJson);
            String destination = envelope.get("destination").asString();
            // Re-serialize just the payload node and hand it to STOMP as raw JSON text -
            // this is byte-for-byte what the old direct convertAndSend(destination, event) sent,
            // so the frontend needs no changes.
            String payloadJson = objectMapper.writeValueAsString(envelope.get("payload"));
            messagingTemplate.convertAndSend(destination, payloadJson);
        } catch (Exception e) {
            log.warn("Could not forward a broadcast message: {}", e.toString());
        }
    }
}