package com.harsha.interview_platform.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class PresenceService {

    private final RedisTemplate<String, String> redisTemplate;

    public PresenceService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private String key(String roomCode) {
        return "presence:room:" + roomCode;
    }

    public void addUserToRoom(String roomCode, String userId) {
        redisTemplate.opsForSet().add(key(roomCode), userId);
    }

    public void removeUserFromRoom(String roomCode, String userId) {
        redisTemplate.opsForSet().remove(key(roomCode), userId);
    }

    public Set<String> getUsersInRoom(String roomCode) {
        return redisTemplate.opsForSet().members(key(roomCode));
    }
}