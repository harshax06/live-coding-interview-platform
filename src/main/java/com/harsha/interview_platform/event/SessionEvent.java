package com.harsha.interview_platform.event;

/**
 * One line in a recording's event log. Serialized as JSON into the Kafka record value;
 * the record KEY is the recording id (sessionId), so all events of a recording go to the same partition (ordered).
 *
 * sessionId = recording id (one Yjs document lifetime). roomCode = the room it happened in; a room can
 * have many recordings over time. eventId is unique per event so redelivery can be ignored (ON CONFLICT).
 * timestamp is assigned by the server (epoch millis), so replay spacing doesn't depend on client clocks.
 * roomCode is null for events written before recordings existed.
 */
public record SessionEvent(
        String eventId,
        String sessionId,
        String roomCode,
        SessionEventType type,
        String userId,
        long timestamp,
        String payload) {}