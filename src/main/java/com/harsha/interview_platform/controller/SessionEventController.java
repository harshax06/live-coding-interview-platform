package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.EditEventRequest;
import com.harsha.interview_platform.event.RecordingIds;
import com.harsha.interview_platform.event.SessionEventProducer;
import com.harsha.interview_platform.event.SessionEventType;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
public class SessionEventController {

    private static final int MAX_UPDATE_CHARS = 100_000;

    private final SessionEventProducer producer;

    public SessionEventController(SessionEventProducer producer) {
        this.producer = producer;
    }

    // Editor keystrokes travel through the Yjs server, which Spring never sees, so each client
    // reports its own local edits here. Nothing is broadcast back; this only feeds the event log.
    @MessageMapping("/events/{roomCode}/edit")
    public void edit(@DestinationVariable String roomCode, EditEventRequest request) {
        String update = request.getUpdate();
        if (update == null || update.isEmpty() || update.length() > MAX_UPDATE_CHARS) return;

        producer.publish(roomCode, RecordingIds.orRoomFallback(roomCode, request.getRecordingId()),
                SessionEventType.EDIT, request.getUserId(), update);
    }
}