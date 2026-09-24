package com.harsha.interview_platform.dto.response;

public class FeedbackSummaryResponse {

    private final long count;
    private final Double averageRating; // null when count == 0

    public FeedbackSummaryResponse(long count, Double averageRating) {
        this.count = count;
        this.averageRating = averageRating;
    }

    public long getCount() { return count; }
    public Double getAverageRating() { return averageRating; }
}