package com.harsha.interview_platform.dto.request;

public class RunRequest {

    private String language;
    private String code;
    private String userId;
    private String recordingId;

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getRecordingId() { return recordingId; }
    public void setRecordingId(String recordingId) { this.recordingId = recordingId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
}