package com.harsha.interview_platform.dto.request;

public class SignalRequest {

    private String type;       // "offer" | "answer" | "ice-candidate"
    private String fromUserId;
    private String toUserId;   // required: WebRTC signaling is always peer-to-peer, never room-wide
    private Object payload;    // the SDP or ICE candidate, passed through untouched

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getFromUserId() { return fromUserId; }
    public void setFromUserId(String fromUserId) { this.fromUserId = fromUserId; }

    public String getToUserId() { return toUserId; }
    public void setToUserId(String toUserId) { this.toUserId = toUserId; }

    public Object getPayload() { return payload; }
    public void setPayload(Object payload) { this.payload = payload; }
}