package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.PresenceJoinRequest;
import com.harsha.interview_platform.service.PresenceService;
import com.harsha.interview_platform.config.PresenceSessionRegistry;
import com.harsha.interview_platform.config.PresenceInfo;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
public class PresenceController {

    private final PresenceService presenceService;
    private final PresenceSessionRegistry sessionRegistry;
    private final RedisTemplate<String, String> redisTemplate;

    public PresenceController(
            PresenceService presenceService,
            PresenceSessionRegistry sessionRegistry,
            RedisTemplate<String, String> redisTemplate) {

        this.presenceService = presenceService;
        this.sessionRegistry = sessionRegistry;
        this.redisTemplate = redisTemplate;
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

        redisTemplate.convertAndSend(
                "presence-events",
                request.getRoomCode()
        );
    }
}