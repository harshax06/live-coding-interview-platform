package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.response.DashboardSessionResponse;
import com.harsha.interview_platform.entity.Feedback;
import com.harsha.interview_platform.entity.FeedbackKind;
import com.harsha.interview_platform.entity.Role;
import com.harsha.interview_platform.entity.User;
import com.harsha.interview_platform.repository.FeedbackRepository;
import com.harsha.interview_platform.repository.SessionEventRecordRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * "Past sessions" here means: recordings this interviewer has left an OVERALL rating on.
 * There's no populated, live-wired Session entity to list from (the JPA Session table from
 * Week 1 was never actually created by the room/run/replay flow, which addresses everything
 * by roomCode + recordingId instead) - OVERALL feedback authorship is the only reliable,
 * authenticated link from a real User back to "sessions I interviewed."
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final FeedbackRepository feedbackRepository;
    private final SessionEventRecordRepository sessionEventRecordRepository;

    public DashboardController(FeedbackRepository feedbackRepository,
                               SessionEventRecordRepository sessionEventRecordRepository) {
        this.feedbackRepository = feedbackRepository;
        this.sessionEventRecordRepository = sessionEventRecordRepository;
    }

    @GetMapping("/sessions")
    public ResponseEntity<?> pastSessions(@AuthenticationPrincipal User user) {
        if (user.getRole() != Role.INTERVIEWER) {
            return ResponseEntity.status(403).body("Only an interviewer has a dashboard");
        }

        List<Feedback> ratedSessions =
                feedbackRepository.findByAuthorIdAndKindOrderByCreatedAtDesc(user.getId(), FeedbackKind.OVERALL);

        List<DashboardSessionResponse> response = ratedSessions.stream()
                .map(f -> {
                    Object[] timing = sessionEventRecordRepository.findTiming(f.getRecordingId());
                    Long startedAt = timing[0] == null ? null : ((Number) timing[0]).longValue();
                    Long endedAt = timing[1] == null ? null : ((Number) timing[1]).longValue();
                    Long eventCount = timing[2] == null ? 0L : ((Number) timing[2]).longValue();
                    return new DashboardSessionResponse(f, startedAt, endedAt, eventCount);
                })
                .toList();

        return ResponseEntity.ok(response);
    }
}