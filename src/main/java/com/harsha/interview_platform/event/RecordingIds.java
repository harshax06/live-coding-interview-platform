package com.harsha.interview_platform.event;

import java.util.regex.Pattern;

/**
 * A "recording" is one lifetime of a collaborative document (one Yjs lineage). The browser that
 * creates the document invents the recording id and stores it inside the document itself, so
 * everyone in the room - and every backend instance - agrees on it without any shared server state.
 */
public final class RecordingIds {

    private static final Pattern VALID = Pattern.compile("[A-Za-z0-9-]{8,64}");

    private RecordingIds() {}

    public static boolean isValid(String id) {
        return id != null && VALID.matcher(id).matches();
    }

    /** The client's recording id, or - for old clients that don't send one - the room code as a catch-all bucket. */
    public static String orRoomFallback(String roomCode, String recordingId) {
        return isValid(recordingId) ? recordingId : roomCode;
    }
}