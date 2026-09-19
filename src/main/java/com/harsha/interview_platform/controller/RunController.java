package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.RunRequest;
import com.harsha.interview_platform.service.RunCoordinator;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

@Controller
public class RunController {

    private final RunCoordinator runCoordinator;

    public RunController(RunCoordinator runCoordinator) {
        this.runCoordinator = runCoordinator;
    }

    // client -> /app/run/{roomCode}; results go out on /topic/run/{roomCode}
    @MessageMapping("/run/{roomCode}")
    public void run(@DestinationVariable String roomCode, RunRequest request) {
        runCoordinator.submit(roomCode, request);
    }
}