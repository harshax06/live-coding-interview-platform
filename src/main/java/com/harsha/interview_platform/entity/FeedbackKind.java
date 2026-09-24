package com.harsha.interview_platform.entity;

public enum FeedbackKind {
    /** One end-of-interview rating + summary comment per (room, recording, author) — resubmitting updates it. */
    OVERALL,
    /** An inline comment anchored to a moment in the session (Day 37/38); no rating, no upsert limit. */
    MOMENT
}