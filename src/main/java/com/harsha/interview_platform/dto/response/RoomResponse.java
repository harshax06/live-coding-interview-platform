package com.harsha.interview_platform.dto.response;

import com.harsha.interview_platform.entity.Room;

import java.time.Instant;

public class RoomResponse {

    private final String joinCode;
    private final String createdByName;
    private final Instant createdAt;

    public RoomResponse(Room room) {
        this.joinCode = room.getJoinCode();
        this.createdByName = room.getCreatedBy().getName();
        this.createdAt = room.getCreatedAt();
    }

    public String getJoinCode() { return joinCode; }
    public String getCreatedByName() { return createdByName; }
    public Instant getCreatedAt() { return createdAt; }
}