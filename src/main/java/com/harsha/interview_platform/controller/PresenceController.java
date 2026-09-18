package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.PresenceJoinRequest;
import com.harsha.interview_platform.model.PresenceInfo;
import com.harsha.interview_platform.service.PresenceService;
import com.harsha.interview_platform.service.PresenceSessionRegistry;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class PresenceController {

    private final PresenceService presenceService;
    private final PresenceSessionRegistry sessionRegistry;
    private final SimpMessagingTemplate messagingTemplate;

    public PresenceController(
            PresenceService presenceService,
            PresenceSessionRegistry sessionRegistry,
            SimpMessagingTemplate messagingTemplate) {

        this.presenceService = presenceService;
        this.sessionRegistry = sessionRegistry;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/presence/join")
    public void join(
            PresenceJoinRequest request,
            @Header("simpSessionId") String sessionId) {

        presenceService.addUserToRoom(
                request.getRoomCode(),
                request.getUserId()
        );

        sessionRegistry.register(
                sessionId,
                new PresenceInfo(
                        request.getRoomCode(),
                        request.getUserId()
                )
        );

        messagingTemplate.convertAndSend(
                "/topic/presence/" + request.getRoomCode(),
                presenceService.getUsersInRoom(request.getRoomCode())
        );
    }
}