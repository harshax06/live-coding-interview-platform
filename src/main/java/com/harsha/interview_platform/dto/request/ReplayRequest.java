package com.harsha.interview_platform.dto.request;

/** Body for /app/replay/{replayId}/start and /seek. Every field is optional except where noted. */
public class ReplayRequest {

    private String roomCode;   // start: required
    private Double speed;      // start: 0.25 - 16, default 1
    private Long maxGapMs;     // start: longest pause kept between events, default 3000; <= 0 means keep real gaps
    private Long positionMs;   // seek: target position on the replay timeline

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public Double getSpeed() { return speed; }
    public void setSpeed(Double speed) { this.speed = speed; }

    public Long getMaxGapMs() { return maxGapMs; }
    public void setMaxGapMs(Long maxGapMs) { this.maxGapMs = maxGapMs; }

    public Long getPositionMs() { return positionMs; }
    public void setPositionMs(Long positionMs) { this.positionMs = positionMs; }
}