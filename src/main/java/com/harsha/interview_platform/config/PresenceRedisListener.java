package com.harsha.interview_platform.config;

import com.harsha.interview_platform.service.PresenceService;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class PresenceRedisListener {

    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    public PresenceRedisListener(
            PresenceService presenceService,
            SimpMessagingTemplate messagingTemplate) {

        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
    }

    public void handleMessage(String roomCode) {

        messagingTemplate.convertAndSend(
                "/topic/presence/" + roomCode,
                presenceService.getUsersInRoom(roomCode)
        );
    }
}