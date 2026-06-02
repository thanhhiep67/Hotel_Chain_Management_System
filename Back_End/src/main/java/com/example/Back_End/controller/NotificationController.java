package com.example.Back_End.controller;

import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.NotificationResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getMyNotifications(
            @RequestParam(required = false) Boolean isRead,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<PageResponse<NotificationResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(notificationService.getMyNotifications(email, isRead, page, size))
                .build());
    }

    @PatchMapping("/read-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> markAllRead(Authentication authentication) {
        notificationService.markAllRead((String) authentication.getPrincipal());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Marked all as read")
                .build());
    }

    @DeleteMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> clearAll(Authentication authentication) {
        notificationService.clearAll((String) authentication.getPrincipal());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Cleared all notifications")
                .build());
    }
}
