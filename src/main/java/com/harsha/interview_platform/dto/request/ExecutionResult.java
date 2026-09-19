package com.harsha.interview_platform.dto.request;

public class ExecutionResult {

    private String stdout;
    private String stderr;
    private int exitCode;
    private boolean timedOut;

    public ExecutionResult(
            String stdout,
            String stderr,
            int exitCode,
            boolean timedOut) {

        this.stdout = stdout;
        this.stderr = stderr;
        this.exitCode = exitCode;
        this.timedOut = timedOut;
    }

    public String getStdout() {
        return stdout;
    }

    public String getStderr() {
        return stderr;
    }

    public int getExitCode() {
        return exitCode;
    }

    public boolean isTimedOut() {
        return timedOut;
    }
}