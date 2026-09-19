package com.harsha.interview_platform.config;

import com.harsha.interview_platform.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.stereotype.Component;

@Component
public class PresenceEventListener {

    private final PresenceSessionRegistry sessionRegistry;
    private final PresenceService presenceService;
    private final RedisTemplate<String, String> redisTemplate;

    public PresenceEventListener(
            PresenceSessionRegistry sessionRegistry,
            PresenceService presenceService,
            RedisTemplate<String, String> redisTemplate) {

        this.sessionRegistry = sessionRegistry;
        this.presenceService = presenceService;
        this.redisTemplate = redisTemplate;
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

                    redisTemplate.convertAndSend(
                            "presence-events",
                            info.roomCode()
                    );
                });
    }
}