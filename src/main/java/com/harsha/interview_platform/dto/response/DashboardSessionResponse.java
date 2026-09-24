package com.harsha.interview_platform.dto.response;

import com.harsha.interview_platform.entity.Feedback;

import java.time.Instant;

public class DashboardSessionResponse {

    private final String roomCode;
    private final String recordingId;
    private final Long startedAt;   // epoch millis of the first recorded event; null if none found
    private final Long endedAt;
    private final Long eventCount;
    private final Integer myRating;
    private final String myComment;
    private final Instant feedbackGivenAt;

    public DashboardSessionResponse(Feedback overallFeedback, Long startedAt, Long endedAt, Long eventCount) {
        this.roomCode = overallFeedback.getRoomCode();
        this.recordingId = overallFeedback.getRecordingId();
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.eventCount = eventCount;
        this.myRating = overallFeedback.getRating();
        this.myComment = overallFeedback.getComment();
        this.feedbackGivenAt = overallFeedback.getCreatedAt();
    }

    public String getRoomCode() { return roomCode; }
    public String getRecordingId() { return recordingId; }
    public Long getStartedAt() { return startedAt; }
    public Long getEndedAt() { return endedAt; }
    public Long getEventCount() { return eventCount; }
    public Integer getMyRating() { return myRating; }
    public String getMyComment() { return myComment; }
    public Instant getFeedbackGivenAt() { return feedbackGivenAt; }
}