package com.harsha.interview_platform.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Keyed by roomCode + recordingId, same as every other live-session record (RunRequest,
 * SessionEvent, etc.) rather than the JPA Session entity's numeric id, which the live app
 * never actually addresses by.
 *
 * OVERALL: at most one per (roomCode, recordingId, author) - resubmitting updates it
 *          (see FeedbackService.submit's upsert). Carries a rating.
 * MOMENT:  any number per session, each anchored to sessionOffsetMs (same unit as
 *          ReplayMessage.playOffsetMs, ms since the recording's first event) so Day 38
 *          can place it on the replay timeline. No rating.
 */
@Entity
@Table(name = "feedback", indexes = {
        @Index(name = "idx_feedback_room_recording", columnList = "room_code, recording_id"),
        @Index(name = "idx_feedback_author_lookup", columnList = "room_code, recording_id, author_id, kind")
})
@Getter
@Setter
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_code", nullable = false)
    private String roomCode;

    // Normalized (never null in storage) via RecordingIds.orRoomFallback, same as SessionEvent -
    // guarantees the upsert lookup and replay join key are never comparing against NULL.
    @Column(name = "recording_id", nullable = false)
    private String recordingId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeedbackKind kind;

    private Integer rating; // OVERALL only, 1-5

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "timestamp_ms")
    private Long timestampMs; // MOMENT only

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant updatedAt; // set on OVERALL upsert; null for a MOMENT row that's never edited
}