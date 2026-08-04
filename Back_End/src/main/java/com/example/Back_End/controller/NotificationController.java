package com.example.Back_End.controller;

import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.NotificationResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Notifications", description = "Thông báo hệ thống — đọc, đánh dấu, xóa")
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "Danh sách thông báo của tôi", security = @SecurityRequirement(name = "bearerAuth"))
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

    @Operation(summary = "Đánh dấu tất cả thông báo đã đọc", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/read-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> markAllRead(Authentication authentication) {
        notificationService.markAllRead((String) authentication.getPrincipal());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Marked all as read")
                .build());
    }

    @Operation(summary = "Xóa toàn bộ thông báo", security = @SecurityRequirement(name = "bearerAuth"))
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
