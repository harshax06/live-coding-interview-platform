package com.harsha.interview_platform.service;

import com.harsha.interview_platform.dto.response.ReplayMessage;
import com.harsha.interview_platform.entity.SessionEventRecord;
import com.harsha.interview_platform.repository.SessionEventRecordRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Plays a recorded session back to a client: reads the event log from Postgres and emits each
 * event to /topic/replay/{replayId} at its original spacing.
 *
 * Timing: every event gets a "play offset" (time since the first event, with long idle gaps
 * capped at maxGapMs). Event i is due at  base + offset[i] / speed  where base is fixed when
 * playing (re)starts - so delays never accumulate drift the way "sleep(gap)" chains do.
 */
@Service
public class ReplayService {

    private static final double MIN_SPEED = 0.25;
    private static final double MAX_SPEED = 16.0;
    private static final long DEFAULT_MAX_GAP_MS = 3_000;
    private static final long IDLE_EXPIRY_MS = 10 * 60_000L;

    private final SessionEventRecordRepository repository;
    private final SimpMessagingTemplate messagingTemplate;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    private final Map<String, ReplaySession> sessions = new ConcurrentHashMap<>();

    public ReplayService(SessionEventRecordRepository repository, SimpMessagingTemplate messagingTemplate) {
        this.repository = repository;
        this.messagingTemplate = messagingTemplate;
        scheduler.scheduleAtFixedRate(this::sweepIdle, 1, 1, TimeUnit.MINUTES);
    }

    // ---- commands (called from ReplayController) ----

    public void start(String replayId, String roomCode, String recordingId, Double speed, Long maxGapMs) {
        close(replayId, false);

        // A specific recording if asked for, otherwise the room's most recent one
        String sessionKey = recordingId == null || recordingId.isBlank() ? null : recordingId.trim();
        if (sessionKey == null) {
            if (roomCode == null || roomCode.isBlank()) {
                send(replayId, ReplayMessage.error(replayId, "roomCode is required"));
                return;
            }
            sessionKey = repository.findLatestSessionKey(roomCode.trim());
        }
        List<SessionEventRecord> events = sessionKey == null
                ? List.of()
                : repository.findBySessionKeyOrderByIdAsc(sessionKey);
        if (events.isEmpty()) {
            send(replayId, ReplayMessage.error(replayId, "No recorded events for room " + roomCode));
            return;
        }

        double s = speed == null ? 1.0 : Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
        long gap = maxGapMs == null ? DEFAULT_MAX_GAP_MS : (maxGapMs <= 0 ? Long.MAX_VALUE : maxGapMs);

        ReplaySession session = new ReplaySession(replayId, events, s, gap);
        sessions.put(replayId, session);
        session.begin();
    }

    public void pause(String replayId) {
        ReplaySession s = sessions.get(replayId);
        if (s != null) s.pause();
    }

    public void resume(String replayId) {
        ReplaySession s = sessions.get(replayId);
        if (s != null) s.resume();
    }

    public void seek(String replayId, long positionMs) {
        ReplaySession s = sessions.get(replayId);
        if (s != null) s.seek(positionMs);
    }

    public void listRecordings(String replayId, String roomCode) {
        if (roomCode == null || roomCode.isBlank()) return;

        List<ReplayMessage.Recording> recordings = new ArrayList<>();
        for (Object[] row : repository.findRecordingRows(roomCode.trim())) {
            recordings.add(new ReplayMessage.Recording(
                    (String) row[0],
                    ((Number) row[1]).longValue(),
                    ((Number) row[2]).longValue(),
                    ((Number) row[3]).longValue()));
        }
        send(replayId, ReplayMessage.recordings(replayId, recordings));
    }

    public void setSpeed(String replayId, Double speed) {
        if (speed == null) return;
        ReplaySession s = sessions.get(replayId);
        if (s != null) s.changeSpeed(Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed)));
    }

    public void stop(String replayId) {
        close(replayId, true);
    }

    // ---- internals ----

    private void close(String replayId, boolean notify) {
        ReplaySession s = sessions.remove(replayId);
        if (s != null) s.closeSession(notify);
    }

    private void sweepIdle() {
        long now = System.currentTimeMillis();
        sessions.forEach((id, s) -> {
            if (s.isIdleSince(now - IDLE_EXPIRY_MS)) close(id, false);
        });
    }

    private void send(String replayId, ReplayMessage message) {
        messagingTemplate.convertAndSend("/topic/replay/" + replayId, message);
    }

    /** State of one running replay. All methods synchronize on the instance. */
    private class ReplaySession {

        private final String replayId;
        private final List<SessionEventRecord> events;
        private final int total;
        private final long[] playOffsetMs;
        private final long durationMs;
        private final long realDurationMs;                  // length of the original session
        private final List<ReplayMessage.Gap> gaps;         // idle stretches that were shortened
        private double speed;              // changeable while playing (see changeSpeed)

        private boolean playing = false;
        private boolean closed = false;
        private int nextIndex = 0;          // next event to emit
        private long positionMs = 0;        // where the timeline stands while not playing
        private long baseNanos = 0;         // wall-clock moment that corresponds to timeline position 0
        private int generation = 0;         // bumped on every pause/seek/stop so stale scheduled ticks do nothing
        private ScheduledFuture<?> pending;
        private long lastTouchedMs = System.currentTimeMillis();

        ReplaySession(String replayId, List<SessionEventRecord> events, double speed, long maxGapMs) {
            this.replayId = replayId;
            this.events = events;
            this.total = events.size();
            this.speed = speed;

            this.playOffsetMs = new long[total];
            List<ReplayMessage.Gap> shortened = new ArrayList<>();
            long offset = 0;
            for (int i = 1; i < total; i++) {
                long gap = Math.max(0, events.get(i).getEventTimestamp() - events.get(i - 1).getEventTimestamp());
                if (gap > maxGapMs) {
                    // remember where on the replay timeline time was cut, and how much
                    shortened.add(new ReplayMessage.Gap(offset, gap - maxGapMs));
                }
                offset += Math.min(gap, maxGapMs);
                playOffsetMs[i] = offset;
            }
            this.durationMs = playOffsetMs[total - 1];
            this.gaps = List.copyOf(shortened);
            this.realDurationMs = Math.max(0,
                    events.get(total - 1).getEventTimestamp() - events.get(0).getEventTimestamp());
        }

        synchronized void begin() {
            send(replayId, ReplayMessage.started(replayId, total, durationMs, realDurationMs, gaps));
            play();
        }

        synchronized void play() {
            if (closed || playing) return;
            if (nextIndex >= total) return;
            touch();
            playing = true;
            baseNanos = System.nanoTime() - (long) (positionMs * 1_000_000L / speed);
            scheduleNext();
        }

        private void scheduleNext() {
            final int gen = generation;
            long dueNanos = baseNanos + (long) (playOffsetMs[nextIndex] * 1_000_000L / speed);
            long delay = Math.max(0, dueNanos - System.nanoTime());
            pending = scheduler.schedule(() -> tick(gen), delay, TimeUnit.NANOSECONDS);
        }

        private synchronized void tick(int gen) {
            if (closed || !playing || gen != generation) return;   // stale tick (paused/seeked meanwhile)

            emit(nextIndex, false);
            positionMs = playOffsetMs[nextIndex];
            nextIndex++;

            if (nextIndex >= total) {
                playing = false;
                generation++;
                positionMs = durationMs;
                send(replayId, ReplayMessage.control("FINISHED", replayId, total, durationMs, durationMs));
            } else {
                scheduleNext();
            }
        }

        synchronized void pause() {
            if (closed || !playing) return;
            touch();
            positionMs = currentPosition();
            halt();
            send(replayId, ReplayMessage.control("PAUSED", replayId, total, durationMs, positionMs));
        }

        /**
         * Change speed without losing our place: freeze the current timeline position,
         * switch speed, and (if we were playing) continue from that same position.
         */
        synchronized void changeSpeed(double newSpeed) {
            if (closed) return;
            touch();
            boolean wasPlaying = playing;
            if (wasPlaying) {
                positionMs = currentPosition();
                halt();
            }
            this.speed = newSpeed;
            if (wasPlaying) play();
        }

        synchronized void resume() {
            if (closed) return;
            if (nextIndex >= total) {   // finished: play again from the start
                seek(0);
            }
            play();
        }

        /** Clear the client, re-send every event up to the target instantly, then continue if it was playing. */
        synchronized void seek(long target) {
            if (closed) return;
            touch();
            boolean wasPlaying = playing;
            halt();

            long clamped = Math.min(Math.max(target, 0), durationMs);
            send(replayId, ReplayMessage.control("RESET", replayId, total, durationMs, 0));

            int count = 0;
            while (count < total && playOffsetMs[count] <= clamped) {
                emit(count, true);
                count++;
            }
            nextIndex = count;
            positionMs = clamped;
            send(replayId, ReplayMessage.control("SEEKED", replayId, total, durationMs, clamped));

            if (wasPlaying) play();
        }

        synchronized void closeSession(boolean notify) {
            if (closed) return;
            halt();
            closed = true;
            if (notify) send(replayId, ReplayMessage.control("STOPPED", replayId, total, durationMs, positionMs));
        }

        synchronized boolean isIdleSince(long thresholdMs) {
            return !playing && lastTouchedMs < thresholdMs;
        }

        /** Timeline position right now while playing: elapsed wall time * speed, never past the next event. */
        private long currentPosition() {
            long elapsedMs = (long) ((System.nanoTime() - baseNanos) / 1_000_000.0 * speed);
            return Math.max(positionMs, Math.min(elapsedMs, playOffsetMs[nextIndex]));
        }

        private void halt() {
            playing = false;
            generation++;
            if (pending != null) pending.cancel(false);
        }

        private void emit(int i, boolean instant) {
            SessionEventRecord e = events.get(i);
            send(replayId, ReplayMessage.event(replayId, i, total, e.getType(), e.getUserId(),
                    e.getEventTimestamp(), playOffsetMs[i], durationMs, e.getPayload(), instant));
        }

        private void touch() {
            lastTouchedMs = System.currentTimeMillis();
        }
    }
}