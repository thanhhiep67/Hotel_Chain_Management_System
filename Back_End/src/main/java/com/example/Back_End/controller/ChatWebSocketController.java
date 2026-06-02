package com.example.Back_End.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Client publishes to /app/chat.typing
     * Payload: { threadId, senderName, typing }
     * Server broadcasts to /topic/chat/{threadId}.typing
     */
    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload Map<String, Object> payload) {
        String threadId = (String) payload.get("threadId");
        if (threadId == null || threadId.isBlank()) return;
        messagingTemplate.convertAndSend("/topic/chat/" + threadId + ".typing", payload);
    }
}
