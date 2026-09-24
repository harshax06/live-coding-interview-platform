package com.harsha.interview_platform.service;

import com.harsha.interview_platform.config.RedisBroadcaster;
import com.harsha.interview_platform.dto.request.ExecutionResult;
import com.harsha.interview_platform.dto.request.RunRequest;
import com.harsha.interview_platform.dto.response.RunEvent;
import com.harsha.interview_platform.event.RecordingIds;
import com.harsha.interview_platform.event.SessionEventProducer;
import com.harsha.interview_platform.event.SessionEventType;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Owns the run lifecycle for a room:
 *  - one run at a time per room, and at most 4 sandboxes across the WHOLE FLEET, enforced via
 *    Redis (RunSlotService) so the limits hold with any number of backend instances
 *  - execution happens off the STOMP thread, results are broadcast to the whole room via Redis
 *    pub/sub (RedisBroadcaster), so a client on any instance receives them
 *  - accepted runs and their results are appended to the session event log (Kafka)
 */
@Service
public class RunCoordinator {

    private static final int MAX_CODE_CHARS = 50_000;

    private final CodeExecutionService executionService;
    private final RedisBroadcaster broadcaster;
    private final SessionEventProducer eventProducer;
    private final RunSlotService slotService;

    private final ExecutorService pool = Executors.newCachedThreadPool();

    public RunCoordinator(CodeExecutionService executionService,
                          RedisBroadcaster broadcaster,
                          SessionEventProducer eventProducer,
                          RunSlotService slotService) {
        this.executionService = executionService;
        this.broadcaster = broadcaster;
        this.eventProducer = eventProducer;
        this.slotService = slotService;
    }

    public void submit(String roomCode, RunRequest request) {
        String user = request.getUserId();
        String code = request.getCode();
        String recordingId = RecordingIds.orRoomFallback(roomCode, request.getRecordingId());

        if (code == null || code.isBlank()) {
            send(roomCode, RunEvent.rejected(user, "Nothing to run - the editor is empty."));
            return;
        }
        if (code.length() > MAX_CODE_CHARS) {
            send(roomCode, RunEvent.rejected(user, "Code is too large to run."));
            return;
        }

        String lockToken = slotService.tryAcquireRoomLock(roomCode);
        if (lockToken == null) {
            send(roomCode, RunEvent.rejected(user, "A run is already in progress in this room."));
            return;
        }
        if (!slotService.tryAcquireCapacity()) {
            slotService.releaseRoomLock(roomCode, lockToken);
            send(roomCode, RunEvent.rejected(user, "Server is busy, try again in a moment."));
            return;
        }

        // Announce before starting so a fast run can't deliver DONE ahead of RUNNING
        send(roomCode, RunEvent.running(user, request.getLanguage()));

        Map<String, Object> requested = new LinkedHashMap<>();
        requested.put("language", request.getLanguage());
        requested.put("code", code);
        eventProducer.publish(roomCode, recordingId, SessionEventType.RUN_REQUESTED, user, requested);

        pool.execute(() -> {
            try {
                ExecutionResult r = executionService.execute(request.getLanguage(), code);
                send(roomCode, RunEvent.done(user, request.getLanguage(),
                        r.getStdout(), r.getStderr(), r.getExitCode(), r.isTimedOut()));
                publishCompleted(roomCode, recordingId, user, request.getLanguage(),
                        r.getStdout(), r.getStderr(), r.getExitCode(), r.isTimedOut());
            } catch (Exception e) {
                String err = "Execution error: " + e.getMessage();
                send(roomCode, RunEvent.done(user, request.getLanguage(), "", err, -1, false));
                publishCompleted(roomCode, recordingId, user, request.getLanguage(), "", err, -1, false);
            } finally {
                slotService.releaseCapacity();
                slotService.releaseRoomLock(roomCode, lockToken);
            }
        });
    }

    private void publishCompleted(String roomCode, String recordingId, String user, String language,
                                  String stdout, String stderr, int exitCode, boolean timedOut) {
        Map<String, Object> completed = new LinkedHashMap<>();
        completed.put("language", language);
        completed.put("stdout", stdout);
        completed.put("stderr", stderr);
        completed.put("exitCode", exitCode);
        completed.put("timedOut", timedOut);
        eventProducer.publish(roomCode, recordingId, SessionEventType.RUN_COMPLETED, user, completed);
    }

    private void send(String roomCode, RunEvent event) {
        broadcaster.publish("/topic/run/" + roomCode, event);
    }
}