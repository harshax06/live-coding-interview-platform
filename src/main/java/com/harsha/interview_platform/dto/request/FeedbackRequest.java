package com.harsha.interview_platform.dto.request;

import com.harsha.interview_platform.entity.FeedbackKind;

public class FeedbackRequest {

    private String roomCode;       // required
    private String recordingId;    // optional - which recording (Day 25) this is about
    private FeedbackKind kind;     // required: OVERALL or MOMENT
    private Integer rating;        // OVERALL only, 1-5
    private String comment;
    private Long timestampMs;      // MOMENT only

    public String getRoomCode() { return roomCode; }
    public void setRoomCode(String roomCode) { this.roomCode = roomCode; }

    public String getRecordingId() { return recordingId; }
    public void setRecordingId(String recordingId) { this.recordingId = recordingId; }

    public FeedbackKind getKind() { return kind; }
    public void setKind(FeedbackKind kind) { this.kind = kind; }

    public Integer getRating() { return rating; }
    public void setRating(Integer rating) { this.rating = rating; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public Long getTimestampMs() { return timestampMs; }
    public void setTimestampMs(Long timestampMs) { this.timestampMs = timestampMs; }
}