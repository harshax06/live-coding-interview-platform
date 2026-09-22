package com.harsha.interview_platform.service;

import com.harsha.interview_platform.dto.request.ExecutionResult;
import com.harsha.interview_platform.dto.request.RunRequest;
import com.harsha.interview_platform.dto.response.RunEvent;
import com.harsha.interview_platform.event.RecordingIds;
import com.harsha.interview_platform.event.SessionEventProducer;
import com.harsha.interview_platform.event.SessionEventType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

/**
 * Owns the run lifecycle for a room:
 *  - one run at a time per room
 *  - at most MAX_CONCURRENT_RUNS sandboxes across the whole server
 *  - execution happens off the STOMP thread, results are broadcast to the whole room
 *  - accepted runs and their results are appended to the session event log (Kafka)
 */
@Service
public class RunCoordinator {

    private static final int MAX_CONCURRENT_RUNS = 4;
    private static final int MAX_CODE_CHARS = 50_000;

    private final CodeExecutionService executionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final SessionEventProducer eventProducer;

    private final Set<String> runningRooms = ConcurrentHashMap.newKeySet();
    private final Semaphore capacity = new Semaphore(MAX_CONCURRENT_RUNS);
    private final ExecutorService pool = Executors.newCachedThreadPool();

    public RunCoordinator(CodeExecutionService executionService,
                          SimpMessagingTemplate messagingTemplate,
                          SessionEventProducer eventProducer) {
        this.executionService = executionService;
        this.messagingTemplate = messagingTemplate;
        this.eventProducer = eventProducer;
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
        if (!runningRooms.add(roomCode)) {
            send(roomCode, RunEvent.rejected(user, "A run is already in progress in this room."));
            return;
        }
        if (!capacity.tryAcquire()) {
            runningRooms.remove(roomCode);
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
                capacity.release();
                runningRooms.remove(roomCode);
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
        messagingTemplate.convertAndSend("/topic/run/" + roomCode, event);
    }
}