package com.harsha.interview_platform.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper; // Boot 4 uses Jackson 3; if this import fails use com.fasterxml.jackson.databind.ObjectMapper

import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Publishes session events to Kafka without ever slowing down or breaking the live session.
 *
 * - Sending happens on ONE background thread: order is preserved and a slow/down broker
 *   can't block STOMP threads.
 * - If the queue fills up (broker down for a long time) new events are dropped with a warning.
 * - Failures are logged, never thrown to the caller.
 */
@Component
public class SessionEventProducer {

    public static final String TOPIC = "session-events";
    private static final Logger log = LoggerFactory.getLogger(SessionEventProducer.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    private final ExecutorService sender = new ThreadPoolExecutor(
            1, 1, 0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(10_000),
            (task, executor) -> log.warn("Event queue full - dropping a session event"));

    public SessionEventProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    /** payload: a String is stored as-is (e.g. base64 Yjs update); any other object is stored as JSON. */
    public void publish(String roomCode, String sessionId, SessionEventType type, String userId, Object payload) {
        long timestamp = System.currentTimeMillis();
        String eventId = UUID.randomUUID().toString();

        sender.execute(() -> {
            try {
                String payloadText = payload instanceof String s ? s : objectMapper.writeValueAsString(payload);
                SessionEvent event = new SessionEvent(eventId, sessionId, roomCode, type, userId, timestamp, payloadText);

                kafkaTemplate.send(TOPIC, sessionId, objectMapper.writeValueAsString(event))
                        .whenComplete((result, ex) -> {
                            if (ex != null) {
                                log.warn("Kafka send failed for {} event in session {}: {}", type, sessionId, ex.toString());
                            }
                        });
            } catch (Exception e) {
                log.warn("Could not publish {} event for session {}: {}", type, sessionId, e.toString());
            }
        });
    }
}