package com.harsha.interview_platform.event;

import com.harsha.interview_platform.repository.SessionEventRecordRepository;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper; // Jackson 3 (Boot 4); if unresolved use com.fasterxml.jackson.databind.ObjectMapper

/**
 * Persists every event from the session-events topic into Postgres.
 *
 * Delivery guarantee: at-least-once. Spring Kafka commits the offset only AFTER this method
 * returns without throwing, so a crash between "insert" and "commit" means the event is
 * redelivered - and the ON CONFLICT insert turns that duplicate into a no-op.
 */
@Component
public class SessionEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(SessionEventConsumer.class);

    private final SessionEventRecordRepository repository;
    private final ObjectMapper objectMapper;

    public SessionEventConsumer(SessionEventRecordRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = SessionEventProducer.TOPIC, groupId = "session-event-persister")
    public void onMessage(ConsumerRecord<String, String> record) {
        SessionEvent event;
        try {
            event = objectMapper.readValue(record.value(), SessionEvent.class);
        } catch (Exception e) {
            // A poison message can never succeed, so retrying would block the partition forever. Skip it.
            log.error("Skipping unparseable event at partition {} offset {}: {}",
                    record.partition(), record.offset(), e.toString());
            return;
        }

        // Database errors are deliberately NOT caught: the exception goes to the error handler
        // (KafkaConsumerConfig), which retries until the database is back. No event is lost.
        int inserted = repository.insertIfAbsent(
                event.eventId(),
                event.sessionId(),
                event.type().name(),
                event.userId() == null ? "unknown" : event.userId(),
                event.timestamp(),
                event.payload(),
                record.partition(),
                record.offset());

        if (inserted == 0) {
            log.debug("Duplicate event {} ignored (redelivery)", event.eventId());
        }
    }
}