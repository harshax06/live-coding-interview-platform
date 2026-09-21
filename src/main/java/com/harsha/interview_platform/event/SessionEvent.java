package com.harsha.interview_platform.event;

/**
 * One line in a session's event log. Serialized as JSON into the Kafka record value;
 * the record KEY is sessionId, so all events of a session go to the same partition (ordered).
 *
 * eventId is unique per event: Day 23's consumer can use it with ON CONFLICT DO NOTHING
 * to stay correct under at-least-once redelivery.
 * timestamp is assigned by the server (epoch millis), so replay spacing doesn't depend on client clocks.
 */
public record SessionEvent(
        String eventId,
        String sessionId,
        SessionEventType type,
        String userId,
        long timestamp,
        String payload) {}