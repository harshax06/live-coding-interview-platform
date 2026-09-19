package com.harsha.interview_platform.dto.response;

/**
 * Broadcast to /topic/run/{roomCode}. Three statuses:
 *  RUNNING  - a run started (both clients show a spinner)
 *  DONE     - finished; stdout/stderr/exitCode/timedOut are filled in
 *  REJECTED - the request was refused; `message` says why (only the requester shows it)
 */
public class RunEvent {

    private final String status;
    private final String requestedBy;
    private final String language;
    private final String stdout;
    private final String stderr;
    private final int exitCode;
    private final boolean timedOut;
    private final String message;

    private RunEvent(String status, String requestedBy, String language,
                     String stdout, String stderr, int exitCode,
                     boolean timedOut, String message) {
        this.status = status;
        this.requestedBy = requestedBy;
        this.language = language;
        this.stdout = stdout;
        this.stderr = stderr;
        this.exitCode = exitCode;
        this.timedOut = timedOut;
        this.message = message;
    }

    public static RunEvent running(String requestedBy, String language) {
        return new RunEvent("RUNNING", requestedBy, language, "", "", 0, false, null);
    }

    public static RunEvent done(String requestedBy, String language,
                                String stdout, String stderr, int exitCode, boolean timedOut) {
        return new RunEvent("DONE", requestedBy, language, stdout, stderr, exitCode, timedOut, null);
    }

    public static RunEvent rejected(String requestedBy, String message) {
        return new RunEvent("REJECTED", requestedBy, null, "", "", 0, false, message);
    }

    public String getStatus() { return status; }
    public String getRequestedBy() { return requestedBy; }
    public String getLanguage() { return language; }
    public String getStdout() { return stdout; }
    public String getStderr() { return stderr; }
    public int getExitCode() { return exitCode; }
    public boolean isTimedOut() { return timedOut; }
    public String getMessage() { return message; }
}