package com.example.Back_End.controller;

import com.example.Back_End.dto.request.MessageRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.MessageResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.ThreadSummaryResponse;
import com.example.Back_End.service.MessageService;
import com.example.Back_End.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService  messageService;
    private final PresenceService presenceService;

    /** Thông tin header của 1 thread (tên khách / tên khách sạn) */
    @GetMapping("/thread-info/{threadId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ThreadSummaryResponse>> getThreadInfo(
            @PathVariable String threadId,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<ThreadSummaryResponse>builder()
                .statusCode(200).message("Success")
                .data(messageService.getThreadInfo(email, threadId))
                .build());
    }

    /** Danh sách hội thoại (inbox) — có phân trang */
    @GetMapping("/threads")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<ThreadSummaryResponse>>> getThreads(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<PageResponse<ThreadSummaryResponse>>builder()
                .statusCode(200).message("Success")
                .data(messageService.getThreads(email, page, size))
                .build());
    }

    /** Lịch sử chat theo thread — có tìm kiếm keyword */
    @GetMapping("/{threadId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<MessageResponse>>> getMessages(
            @PathVariable String threadId,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "30")  int size,
            @RequestParam(required = false)     String keyword,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<PageResponse<MessageResponse>>builder()
                .statusCode(200).message("Success")
                .data(messageService.getMessages(email, threadId, page, size, keyword))
                .build());
    }

    /** Gửi tin nhắn */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MessageResponse>> sendMessage(
            @RequestBody MessageRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<MessageResponse>builder()
                        .statusCode(HttpStatus.CREATED.value()).message("Message sent")
                        .data(messageService.sendMessage(email, request))
                        .build());
    }

    /** Upload ảnh đính kèm — trả về URL để dùng trong sendMessage */
    @PostMapping("/upload-image")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> uploadImage(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<String>builder()
                .statusCode(200).message("Uploaded")
                .data(messageService.uploadImage(email, file))
                .build());
    }

    /** Đánh dấu đã đọc toàn bộ thread */
    @PatchMapping("/{threadId}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Long>> markAsRead(
            @PathVariable String threadId,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        long count = messageService.markAsRead(email, threadId);
        return ResponseEntity.ok(ApiResponse.<Long>builder()
                .statusCode(200).message("Marked " + count + " message(s) as read")
                .data(count).build());
    }

    /** Trạng thái online của danh sách userId */
    @GetMapping("/online-status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> getOnlineStatus(
            @RequestParam List<String> userIds) {
        return ResponseEntity.ok(ApiResponse.<Map<String, Boolean>>builder()
                .statusCode(200).message("Success")
                .data(presenceService.getBulkStatus(userIds))
                .build());
    }
}
