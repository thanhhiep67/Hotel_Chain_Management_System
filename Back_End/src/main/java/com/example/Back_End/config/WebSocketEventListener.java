package com.example.Back_End.config;

import com.example.Back_End.repository.UserRepository;
import com.example.Back_End.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final PresenceService presenceService;
    private final UserRepository  userRepository;

    @EventListener
    public void onConnect(SessionConnectedEvent event) {
        String email = event.getUser() != null ? event.getUser().getName() : null;
        if (email == null) return;
        userRepository.findByEmail(email)
                .ifPresent(u -> presenceService.setOnline(u.getId()));
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String email = event.getUser() != null ? event.getUser().getName() : null;
        if (email == null) return;
        userRepository.findByEmail(email)
                .ifPresent(u -> presenceService.setOffline(u.getId()));
    }
}
