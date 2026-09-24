package com.harsha.interview_platform.service;

import com.harsha.interview_platform.dto.request.FeedbackRequest;
import com.harsha.interview_platform.entity.Feedback;
import com.harsha.interview_platform.entity.FeedbackKind;
import com.harsha.interview_platform.entity.User;
import com.harsha.interview_platform.repository.FeedbackRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class FeedbackService {

    private final FeedbackRepository repository;

    public FeedbackService(FeedbackRepository repository) {
        this.repository = repository;
    }

    /** Validates, then either updates the author's existing OVERALL row or inserts a new MOMENT row. */
    public Feedback submit(FeedbackRequest request, User author) {
        if (request.getRoomCode() == null || request.getRoomCode().isBlank()) {
            throw new IllegalArgumentException("roomCode is required");
        }
        if (request.getKind() == null) {
            throw new IllegalArgumentException("kind is required");
        }

        if (request.getKind() == FeedbackKind.OVERALL) {
            if (request.getRating() == null || request.getRating() < 1 || request.getRating() > 5) {
                throw new IllegalArgumentException("rating must be between 1 and 5 for OVERALL feedback");
            }
            // Upsert: an interviewer revising their rating before finalizing updates the same row
            // rather than piling up duplicates.
            Feedback feedback = repository
                    .findByRoomCodeAndRecordingIdAndAuthorIdAndKind(
                            request.getRoomCode(), request.getRecordingId(), author.getId(), FeedbackKind.OVERALL)
                    .orElseGet(() -> {
                        Feedback f = new Feedback();
                        f.setRoomCode(request.getRoomCode());
                        f.setRecordingId(request.getRecordingId());
                        f.setAuthor(author);
                        f.setKind(FeedbackKind.OVERALL);
                        return f;
                    });
            feedback.setRating(request.getRating());
            feedback.setComment(request.getComment());
            feedback.setUpdatedAt(Instant.now());
            return repository.save(feedback);
        }

        // MOMENT: always a new row, never upserted
        if (request.getComment() == null || request.getComment().isBlank()) {
            throw new IllegalArgumentException("comment is required for MOMENT feedback");
        }
        Feedback feedback = new Feedback();
        feedback.setRoomCode(request.getRoomCode());
        feedback.setRecordingId(request.getRecordingId());
        feedback.setAuthor(author);
        feedback.setKind(FeedbackKind.MOMENT);
        feedback.setComment(request.getComment());
        feedback.setTimestampMs(request.getTimestampMs());
        return repository.save(feedback);
    }

    public List<Feedback> listForRoom(String roomCode, String recordingId) {
        return repository.findForRoom(roomCode, recordingId);
    }
}