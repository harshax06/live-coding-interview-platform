package com.harsha.interview_platform.dto.request;

public class EditEventRequest {

    private String userId;
    private String update; // base64 Yjs update

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUpdate() { return update; }
    public void setUpdate(String update) { this.update = update; }
}