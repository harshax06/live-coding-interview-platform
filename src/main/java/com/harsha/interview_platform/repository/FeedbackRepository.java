package com.harsha.interview_platform.repository;

import com.harsha.interview_platform.entity.Feedback;
import com.harsha.interview_platform.entity.FeedbackKind;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    // recordingId is always normalized non-null before this is called (RecordingIds.orRoomFallback),
    // so a plain "=" comparison is safe - no NULL-vs-NULL derived-query pitfall to work around.
    Optional<Feedback> findByRoomCodeAndRecordingIdAndAuthorIdAndKind(
            String roomCode, String recordingId, Long authorId, FeedbackKind kind);

    // MOMENT comments in timeline order, then the OVERALL row(s) last - matches how Day 38
    // will want to walk the list: place every MOMENT on the replay scrub bar, show OVERALL
    // as a summary card once playback reaches the end.
    @Query("""
            SELECT f FROM Feedback f
            WHERE f.roomCode = :roomCode AND f.recordingId = :recordingId
            ORDER BY f.kind DESC, f.timestampMs ASC NULLS LAST, f.createdAt ASC
            """)
    List<Feedback> findForRoom(@Param("roomCode") String roomCode, @Param("recordingId") String recordingId);

    // For a Day 39 dashboard card: this recording's OVERALL ratings (usually one per interviewer)
    @Query("""
            SELECT AVG(f.rating), COUNT(f) FROM Feedback f
            WHERE f.roomCode = :roomCode AND f.recordingId = :recordingId AND f.kind = 'OVERALL'
            """)
    Object[] findRatingSummary(@Param("roomCode") String roomCode, @Param("recordingId") String recordingId);

    // The Day 39 dashboard itself: every session this interviewer has actually rated, newest first.
    // OVERALL feedback is the right signal for "sessions I interviewed" - session_events has no
    // real interviewer/candidate distinction (its userId is just an ad hoc STOMP string), so this
    // authenticated author_id is the only reliable link back to a real User for this feature.
    List<Feedback> findByAuthorIdAndKindOrderByCreatedAtDesc(Long authorId, FeedbackKind kind);
}