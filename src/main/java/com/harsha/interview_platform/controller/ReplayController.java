package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.ReplayRequest;
import com.harsha.interview_platform.service.ReplayService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

/**
 * Replay control over STOMP. The client picks a replayId (any unique string), SUBSCRIBES to
 * /topic/replay/{replayId} first, then sends commands to /app/replay/{replayId}/...
 */
@Controller
public class ReplayController {

    private final ReplayService replayService;

    public ReplayController(ReplayService replayService) {
        this.replayService = replayService;
    }

    @MessageMapping("/replay/{replayId}/start")
    public void start(@DestinationVariable String replayId, ReplayRequest request) {
        if (!validId(replayId)) return;
        replayService.start(replayId, request.getRoomCode(), request.getSpeed(), request.getMaxGapMs());
    }

    @MessageMapping("/replay/{replayId}/pause")
    public void pause(@DestinationVariable String replayId) {
        if (validId(replayId)) replayService.pause(replayId);
    }

    @MessageMapping("/replay/{replayId}/resume")
    public void resume(@DestinationVariable String replayId) {
        if (validId(replayId)) replayService.resume(replayId);
    }

    @MessageMapping("/replay/{replayId}/seek")
    public void seek(@DestinationVariable String replayId, ReplayRequest request) {
        if (validId(replayId) && request.getPositionMs() != null) {
            replayService.seek(replayId, request.getPositionMs());
        }
    }

    @MessageMapping("/replay/{replayId}/stop")
    public void stop(@DestinationVariable String replayId) {
        if (validId(replayId)) replayService.stop(replayId);
    }

    private boolean validId(String replayId) {
        return replayId != null && !replayId.isBlank() && replayId.length() <= 64;
    }
}