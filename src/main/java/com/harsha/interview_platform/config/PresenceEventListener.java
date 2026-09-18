package com.harsha.interview_platform.config;

import com.harsha.interview_platform.model.PresenceInfo;
import com.harsha.interview_platform.service.PresenceService;
import com.harsha.interview_platform.service.PresenceSessionRegistry;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class PresenceEventListener {

    private final PresenceSessionRegistry sessionRegistry;
    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    public PresenceEventListener(
            PresenceSessionRegistry sessionRegistry,
            PresenceService presenceService,
            SimpMessagingTemplate messagingTemplate) {

        this.sessionRegistry = sessionRegistry;
        this.presenceService = presenceService;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {

        String sessionId =
                SimpMessageHeaderAccessor
                        .wrap(event.getMessage())
                        .getSessionId();

        sessionRegistry.unregister(sessionId)
                .ifPresent((PresenceInfo info) -> {

                    presenceService.removeUserFromRoom(
                            info.roomCode(),
                            info.userId()
                    );

                    messagingTemplate.convertAndSend(
                            "/topic/presence/" + info.roomCode(),
                            presenceService.getUsersInRoom(
                                    info.roomCode()
                            )
                    );
                });
    }
}