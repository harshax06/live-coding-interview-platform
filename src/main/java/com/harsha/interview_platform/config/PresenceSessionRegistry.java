package com.harsha.interview_platform.config;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PresenceSessionRegistry {

    private final Map<String, PresenceInfo> sessionMap =
            new ConcurrentHashMap<>();

    public void register(String sessionId, PresenceInfo info) {
        sessionMap.put(sessionId, info);
    }

    public Optional<PresenceInfo> unregister(String sessionId) {
        return Optional.ofNullable(sessionMap.remove(sessionId));
    }
}