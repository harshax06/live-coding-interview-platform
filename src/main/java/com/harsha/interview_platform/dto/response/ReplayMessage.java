package com.harsha.interview_platform.dto.response;

import java.util.List;

/**
 * Everything the server sends to /topic/replay/{replayId}.
 *
 * kind:
 *   RECORDINGS - answer to "list": the room's recordings, newest first
 *   STARTED  - replay is ready (now also carries feedback: comments + overallFeedback): total events, durationMs (replay timeline), realDurationMs (original
 *              session length) and gaps (where idle time was shortened)
 *   EVENT    - one recorded event; instant=true means it is part of a catch-up burst after RESET
 *   RESET    - client must clear its replayed state; a burst of instant EVENTs follows (seek / restart)
 *   SEEKED   - the burst is done; positionMs is where the timeline now stands
 *   PAUSED   - positionMs is where playback stopped
 *   FINISHED - the last event was emitted
 *   STOPPED  - the replay was closed
 *   ERROR    - message explains why
 */
public class ReplayMessage {

    /** An idle stretch that was shortened: it sits at positionMs on the replay timeline and skippedMs were cut. */
    public record Gap(long positionMs, long skippedMs) {}

    /** One recorded session of a room. startedAt / endedAt are epoch millis of its first / last event. */
    public record Recording(String recordingId, long startedAt, long endedAt, long eventCount) {}

    /**
     * A MOMENT feedback comment, placed on the (possibly idle-gap-compressed) replay timeline.
     * playOffsetMs is NOT the raw Feedback.timestampMs - ReplayService maps it onto this
     * recording's actual event timeline and applies the same gap compression events get, so a
     * comment made during a long real pause lands right where that pause resolves on the replay,
     * not stranded deep inside a stretch of compressed-away time.
     */
    public record Comment(Long id, String authorName, String comment, long playOffsetMs) {}

    /** An OVERALL rating - shown as a persistent summary card, not tied to a moment. */
    public record OverallFeedback(String authorName, Integer rating, String comment) {}

    private final String kind;
    private final String replayId;
    private final int index;
    private final int total;
    private final String type;
    private final String userId;
    private final long timestamp;
    private final long playOffsetMs;
    private final long durationMs;
    private final long realDurationMs;
    private final long positionMs;
    private final String payload;
    private final boolean instant;
    private final String message;
    private final List<Gap> gaps;
    private final List<Recording> recordings;
    private final List<Comment> comments;
    private final List<OverallFeedback> overallFeedback;

    private ReplayMessage(String kind, String replayId, int index, int total, String type, String userId,
                          long timestamp, long playOffsetMs, long durationMs, long realDurationMs,
                          long positionMs, String payload, boolean instant, String message, List<Gap> gaps,
                          List<Recording> recordings, List<Comment> comments,
                          List<OverallFeedback> overallFeedback) {
        this.kind = kind;
        this.replayId = replayId;
        this.index = index;
        this.total = total;
        this.type = type;
        this.userId = userId;
        this.timestamp = timestamp;
        this.playOffsetMs = playOffsetMs;
        this.durationMs = durationMs;
        this.realDurationMs = realDurationMs;
        this.positionMs = positionMs;
        this.payload = payload;
        this.instant = instant;
        this.message = message;
        this.gaps = gaps;
        this.recordings = recordings;
        this.comments = comments;
        this.overallFeedback = overallFeedback;
    }

    public static ReplayMessage started(String replayId, int total, long durationMs, long realDurationMs,
                                        List<Gap> gaps, List<Comment> comments, List<OverallFeedback> overallFeedback) {
        return new ReplayMessage("STARTED", replayId, -1, total, null, null, 0, 0,
                durationMs, realDurationMs, 0, null, false, null, gaps, List.of(), comments, overallFeedback);
    }

    public static ReplayMessage control(String kind, String replayId, int total, long durationMs, long positionMs) {
        return new ReplayMessage(kind, replayId, -1, total, null, null, 0, 0,
                durationMs, 0, positionMs, null, false, null, List.of(), List.of(), List.of(), List.of());
    }

    public static ReplayMessage event(String replayId, int index, int total, String type, String userId,
                                      long timestamp, long playOffsetMs, long durationMs,
                                      String payload, boolean instant) {
        return new ReplayMessage("EVENT", replayId, index, total, type, userId, timestamp,
                playOffsetMs, durationMs, 0, playOffsetMs, payload, instant, null, List.of(), List.of(), List.of(), List.of());
    }

    public static ReplayMessage recordings(String replayId, List<Recording> recordings) {
        return new ReplayMessage("RECORDINGS", replayId, -1, 0, null, null, 0, 0, 0, 0, 0, null, false, null,
                List.of(), recordings, List.of(), List.of());
    }

    public static ReplayMessage error(String replayId, String message) {
        return new ReplayMessage("ERROR", replayId, -1, 0, null, null, 0, 0, 0, 0, 0, null, false, message, List.of(), List.of(), List.of(), List.of());
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
    public long getRealDurationMs() { return realDurationMs; }
    public long getPositionMs() { return positionMs; }
    public String getPayload() { return payload; }
    public boolean isInstant() { return instant; }
    public String getMessage() { return message; }
    public List<Gap> getGaps() { return gaps; }
    public List<Recording> getRecordings() { return recordings; }
    public List<Comment> getComments() { return comments; }
    public List<OverallFeedback> getOverallFeedback() { return overallFeedback; }
}