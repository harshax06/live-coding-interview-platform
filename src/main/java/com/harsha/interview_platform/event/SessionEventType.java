package com.harsha.interview_platform.event;

public enum SessionEventType {
    EDIT,           // a Yjs document update (base64) - replaying these rebuilds the editor state
    RUN_REQUESTED,  // {language, code}
    RUN_COMPLETED,  // {language, stdout, stderr, exitCode, timedOut}
    FEEDBACK        // reserved for Week 8
}