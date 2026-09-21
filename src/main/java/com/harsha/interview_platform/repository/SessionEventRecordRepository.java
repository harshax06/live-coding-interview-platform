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
                (event_id, session_key, type, user_id, event_timestamp, payload, kafka_partition, kafka_offset)
            VALUES
                (:eventId, :sessionKey, :type, :userId, :eventTimestamp, :payload, :kafkaPartition, :kafkaOffset)
            ON CONFLICT (event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("eventId") String eventId,
                       @Param("sessionKey") String sessionKey,
                       @Param("type") String type,
                       @Param("userId") String userId,
                       @Param("eventTimestamp") long eventTimestamp,
                       @Param("payload") String payload,
                       @Param("kafkaPartition") int kafkaPartition,
                       @Param("kafkaOffset") long kafkaOffset);

    // For Day 24 replay. One session = one partition, so insertion order (id) is the true event order.
    List<SessionEventRecord> findBySessionKeyOrderByIdAsc(String sessionKey);
}