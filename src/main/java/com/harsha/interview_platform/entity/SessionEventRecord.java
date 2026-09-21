package com.harsha.interview_platform.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * One persisted line of a session's event log (the raw stream from Kafka).
 * Append-only: rows are never updated.
 */
@Entity
@Table(
        name = "session_events",
        indexes = @Index(name = "idx_session_events_session_key", columnList = "session_key, id"))
@Getter
@Setter
public class SessionEventRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The UNIQUE constraint is what makes "INSERT ... ON CONFLICT DO NOTHING" safe under redelivery
    @Column(name = "event_id", nullable = false, unique = true)
    private String eventId;

    // The Kafka record key (the room code today). Not the same thing as sessions.id.
    @Column(name = "session_key", nullable = false)
    private String sessionKey;

    @Column(nullable = false)
    private String type;

    @Column(name = "user_id", nullable = false)
    private String userId;

    // Server-assigned epoch millis - replay spacing is computed from these
    @Column(name = "event_timestamp", nullable = false)
    private long eventTimestamp;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    // Where the event lived in Kafka - useful for debugging and for ordering
    @Column(name = "kafka_partition", nullable = false)
    private int kafkaPartition;

    @Column(name = "kafka_offset", nullable = false)
    private long kafkaOffset;
}