package com.harsha.interview_platform.dto.response;

/**
 * Everything the server sends to /topic/replay/{replayId}.
 *
 * kind:
 *   STARTED  - replay is ready: total events, durationMs (length of the timeline)
 *   EVENT    - one recorded event; instant=true means it is part of a catch-up burst after RESET
 *   RESET    - client must clear its replayed state; a burst of instant EVENTs follows (seek / restart)
 *   SEEKED   - the burst is done; positionMs is where the timeline now stands
 *   PAUSED   - positionMs is where playback stopped
 *   FINISHED - the last event was emitted
 *   STOPPED  - the replay was closed
 *   ERROR    - message explains why
 */
public class ReplayMessage {

    private final String kind;
    private final String replayId;
    private final int index;
    private final int total;
    private final String type;
    private final String userId;
    private final long timestamp;
    private final long playOffsetMs;
    private final long durationMs;
    private final long positionMs;
    private final String payload;
    private final boolean instant;
    private final String message;

    private ReplayMessage(String kind, String replayId, int index, int total, String type, String userId,
                          long timestamp, long playOffsetMs, long durationMs, long positionMs,
                          String payload, boolean instant, String message) {
        this.kind = kind;
        this.replayId = replayId;
        this.index = index;
        this.total = total;
        this.type = type;
        this.userId = userId;
        this.timestamp = timestamp;
        this.playOffsetMs = playOffsetMs;
        this.durationMs = durationMs;
        this.positionMs = positionMs;
        this.payload = payload;
        this.instant = instant;
        this.message = message;
    }

    public static ReplayMessage control(String kind, String replayId, int total, long durationMs, long positionMs) {
        return new ReplayMessage(kind, replayId, -1, total, null, null, 0, 0, durationMs, positionMs, null, false, null);
    }

    public static ReplayMessage event(String replayId, int index, int total, String type, String userId,
                                      long timestamp, long playOffsetMs, long durationMs,
                                      String payload, boolean instant) {
        return new ReplayMessage("EVENT", replayId, index, total, type, userId, timestamp,
                playOffsetMs, durationMs, playOffsetMs, payload, instant, null);
    }

    public static ReplayMessage error(String replayId, String message) {
        return new ReplayMessage("ERROR", replayId, -1, 0, null, null, 0, 0, 0, 0, null, false, message);
    }

    public String getKind() { return kind; }
    public String getReplayId() { return replayId; }
    public int getIndex() { return index; }
    public int getTotal() { return total; }
    public String getType() { return type; }
    public String getUserId() { return userId; }
    public long getTimestamp() { return timestamp; }
    public long getPlayOffsetMs() { return playOffsetMs; }
    public long getDurationMs() { return durationMs; }
    public long getPositionMs() { return positionMs; }
    public String getPayload() { return payload; }
    public boolean isInstant() { return instant; }
    public String getMessage() { return message; }
}