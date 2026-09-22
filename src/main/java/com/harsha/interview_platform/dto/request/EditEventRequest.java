package com.harsha.interview_platform.dto.request;

public class EditEventRequest {

    private String userId;
    private String update; // base64 Yjs update
    private String recordingId;

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getRecordingId() { return recordingId; }
    public void setRecordingId(String recordingId) { this.recordingId = recordingId; }

    public String getUpdate() { return update; }
    public void setUpdate(String update) { this.update = update; }
}