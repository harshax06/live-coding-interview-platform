package com.harsha.interview_platform.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketController {

    @MessageMapping("/echo")
    @SendTo("/topic/echo")
    public String echo(String message) {
        System.out.println("Received: " + message);
        return message ;
    }

}
