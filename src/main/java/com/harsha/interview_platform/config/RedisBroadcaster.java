package com.harsha.interview_platform.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper; // Jackson 3 (Boot 4); if unresolved use com.fasterxml.jackson.databind.ObjectMapper

/**
 * Turns a local STOMP broadcast into a cluster-wide one, the same way PresenceController's
 * "presence-events" channel already does, generalized to any destination.
 *
 * Any service that used to call messagingTemplate.convertAndSend(destination, event) directly
 * calls this instead. Every instance (including the one that published) receives the message
 * back via BroadcastRedisListener and forwards it to its OWN locally-connected STOMP sessions.
 * A single shared channel is used for every destination, rather than one Redis channel per
 * destination, since STOMP destinations are created dynamically (one per room/replayId) and
 * Redis channels are not meant to be created and torn down at that rate.
 */
@Component
public class RedisBroadcaster {

    private static final String CHANNEL = "app-broadcast";
    private static final Logger log = LoggerFactory.getLogger(RedisBroadcaster.class);

    /** {destination, payload} wire shape sent over the Redis channel. */
    public record Envelope(String destination, Object payload) {}

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisBroadcaster(RedisTemplate<String, String> redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /** Fire-and-forget: publish is never allowed to throw into the caller (a run/replay/signal flow). */
    public void publish(String destination, Object payload) {
        try {
            String envelopeJson = objectMapper.writeValueAsString(new Envelope(destination, payload));
            redisTemplate.convertAndSend(CHANNEL, envelopeJson);
        } catch (Exception e) {
            log.warn("Could not broadcast to {}: {}", destination, e.toString());
        }
    }

    public static String channel() {
        return CHANNEL;
    }
}