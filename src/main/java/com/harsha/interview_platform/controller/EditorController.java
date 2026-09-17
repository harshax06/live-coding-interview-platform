package com.harsha.interview_platform.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class EditorController {

    @MessageMapping("/editor")
    @SendTo("/topic/editor")
    public String updateEditor(String content) {
        return content;
    }
}