package com.harsha.interview_platform.controller;

import com.harsha.interview_platform.dto.request.ExecutionRequest;
import com.harsha.interview_platform.dto.request.ExecutionResult;
import com.harsha.interview_platform.service.CodeExecutionService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/test")
public class ExecutionTestController {

    private final CodeExecutionService executionService;

    public ExecutionTestController(
            CodeExecutionService executionService) {

        this.executionService = executionService;
    }

    @PostMapping("/execute")
    public ExecutionResult execute(
            @RequestBody ExecutionRequest request) {

        return executionService.execute(request.getCode());
    }
}