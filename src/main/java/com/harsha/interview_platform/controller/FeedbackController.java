package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.FeedbackRequest;
import com.harsha.interview_platform.dto.response.FeedbackResponse;
import com.harsha.interview_platform.dto.response.FeedbackSummaryResponse;
import com.harsha.interview_platform.entity.Feedback;
import com.harsha.interview_platform.entity.Role;
import com.harsha.interview_platform.entity.User;
import com.harsha.interview_platform.event.RecordingIds;
import com.harsha.interview_platform.repository.FeedbackRepository;
import com.harsha.interview_platform.service.FeedbackService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST, not STOMP - unlike run/edit/replay, feedback needs a real authenticated author
 * (JwtAuthFilter + @AuthenticationPrincipal User), and nothing about submitting it is
 * latency-sensitive the way a keystroke or a run result is.
 */
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final FeedbackRepository feedbackRepository;

    public FeedbackController(FeedbackService feedbackService, FeedbackRepository feedbackRepository) {
        this.feedbackService = feedbackService;
        this.feedbackRepository = feedbackRepository;
    }

    @PostMapping
    public ResponseEntity<?> submit(@RequestBody FeedbackRequest request, @AuthenticationPrincipal User user) {
        if (user.getRole() != Role.INTERVIEWER) {
            return ResponseEntity.status(403).body("Only an interviewer can leave feedback");
        }
        try {
            normalize(request);
            Feedback feedback = feedbackService.submit(request, user);
            return ResponseEntity.status(201).body(new FeedbackResponse(feedback));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam String roomCode,
                                  @RequestParam(required = false) String recordingId) {
        if (roomCode == null || roomCode.isBlank()) {
            return ResponseEntity.badRequest().body("roomCode is required");
        }
        String normalized = RecordingIds.orRoomFallback(roomCode, recordingId);
        List<FeedbackResponse> response = feedbackService.listForRoom(roomCode, normalized).stream()
                .map(FeedbackResponse::new)
                .toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/summary")
    public ResponseEntity<?> summary(@RequestParam String roomCode,
                                     @RequestParam(required = false) String recordingId) {
        if (roomCode == null || roomCode.isBlank()) {
            return ResponseEntity.badRequest().body("roomCode is required");
        }
        String normalized = RecordingIds.orRoomFallback(roomCode, recordingId);
        Object[] row = feedbackRepository.findRatingSummary(roomCode, normalized);
        Double avg = row[0] == null ? null : ((Number) row[0]).doubleValue();
        long count = row[1] == null ? 0 : ((Number) row[1]).longValue();
        return ResponseEntity.ok(new FeedbackSummaryResponse(count, avg));
    }

    // FeedbackRequest.recordingId can arrive null from the client; every stored row and every
    // lookup needs the same normalized value SessionEvent already uses, or an OVERALL upsert
    // could silently create a second row instead of updating the first.
    private void normalize(FeedbackRequest request) {
        request.setRecordingId(RecordingIds.orRoomFallback(request.getRoomCode(), request.getRecordingId()));
    }
}