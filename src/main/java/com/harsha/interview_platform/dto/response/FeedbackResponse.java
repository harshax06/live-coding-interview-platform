package com.harsha.interview_platform.dto.response;

import com.harsha.interview_platform.entity.Feedback;
import com.harsha.interview_platform.entity.FeedbackKind;

import java.time.Instant;

public class FeedbackResponse {

    private final Long id;
    private final String roomCode;
    private final String recordingId;
    private final Long authorId;
    private final String authorName;
    private final FeedbackKind kind;
    private final Integer rating;
    private final String comment;
    private final Long timestampMs;
    private final Instant createdAt;
    private final Instant updatedAt;

    public FeedbackResponse(Feedback f) {
        this.id = f.getId();
        this.roomCode = f.getRoomCode();
        this.recordingId = f.getRecordingId();
        this.authorId = f.getAuthor().getId();
        this.authorName = f.getAuthor().getName();
        this.kind = f.getKind();
        this.rating = f.getRating();
        this.comment = f.getComment();
        this.timestampMs = f.getTimestampMs();
        this.createdAt = f.getCreatedAt();
        this.updatedAt = f.getUpdatedAt();
    }

    public Long getId() { return id; }
    public String getRoomCode() { return roomCode; }
    public String getRecordingId() { return recordingId; }
    public Long getAuthorId() { return authorId; }
    public String getAuthorName() { return authorName; }
    public FeedbackKind getKind() { return kind; }
    public Integer getRating() { return rating; }
    public String getComment() { return comment; }
    public Long getTimestampMs() { return timestampMs; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}