package com.harsha.interview_platform.repository;

import com.harsha.interview_platform.entity.SessionEventRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface SessionEventRecordRepository extends JpaRepository<SessionEventRecord, Long> {

    /**
     * Idempotent insert. Kafka delivers at-least-once, so the same event can arrive twice;
     * the second insert hits the unique event_id and is silently ignored.
     * Returns 1 if a row was inserted, 0 if it was a duplicate.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO session_events
                (event_id, session_key, room_code, type, user_id, event_timestamp, payload, kafka_partition, kafka_offset)
            VALUES
                (:eventId, :sessionKey, :roomCode, :type, :userId, :eventTimestamp, :payload, :kafkaPartition, :kafkaOffset)
            ON CONFLICT (event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("eventId") String eventId,
                       @Param("sessionKey") String sessionKey,
                       @Param("roomCode") String roomCode,
                       @Param("type") String type,
                       @Param("userId") String userId,
                       @Param("eventTimestamp") long eventTimestamp,
                       @Param("payload") String payload,
                       @Param("kafkaPartition") int kafkaPartition,
                       @Param("kafkaOffset") long kafkaOffset);

    // All events of ONE recording, in true order (one recording = one partition, so insertion order = event order)
    List<SessionEventRecord> findBySessionKeyOrderByIdAsc(String sessionKey);

    // Most recent recording of a room (the "session_key = :roomCode" part finds old catch-all rows)
    @Query(value = """
            SELECT session_key FROM session_events
            WHERE room_code = :roomCode OR session_key = :roomCode
            ORDER BY id DESC
            LIMIT 1
            """, nativeQuery = true)
    String findLatestSessionKey(@Param("roomCode") String roomCode);

    // One row per recording of a room, newest first: [session_key, first timestamp, last timestamp, event count]
    @Query(value = """
            SELECT session_key, MIN(event_timestamp), MAX(event_timestamp), COUNT(*)
            FROM session_events
            WHERE room_code = :roomCode OR session_key = :roomCode
            GROUP BY session_key
            ORDER BY MIN(id) DESC
            LIMIT 50
            """, nativeQuery = true)
    List<Object[]> findRecordingRows(@Param("roomCode") String roomCode);

    // Day 39 dashboard: how long a specific recording ran and how many events it has
    @Query(value = """
            SELECT MIN(event_timestamp), MAX(event_timestamp), COUNT(*)
            FROM session_events
            WHERE session_key = :recordingId
            """, nativeQuery = true)
    Object[] findTiming(@Param("recordingId") String recordingId);
}