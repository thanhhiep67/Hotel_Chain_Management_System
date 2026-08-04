package com.example.Back_End.controller;

import com.example.Back_End.dto.request.OwnerReplyRequest;
import com.example.Back_End.dto.request.ReviewRequest;
import com.example.Back_End.dto.request.UpdateReviewStatusRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.ReviewResponse;
import com.example.Back_End.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Reviews", description = "Đánh giá khách sạn — tạo, phản hồi, kiểm duyệt")
@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @Operation(summary = "Tạo đánh giá — chỉ khách đã check-out (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<ReviewResponse>> createReview(
            @RequestBody ReviewRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        ReviewResponse response = reviewService.createReview(email, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<ReviewResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("Review created")
                        .data(response)
                        .build());
    }

    @Operation(summary = "Phản hồi đánh giá của khách (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/reply")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<ReviewResponse>> replyToReview(
            @PathVariable String id,
            @RequestBody OwnerReplyRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        ReviewResponse response = reviewService.addOwnerReply(email, id, request);
        return ResponseEntity.ok(ApiResponse.<ReviewResponse>builder()
                .statusCode(200)
                .message("Reply saved")
                .data(response)
                .build());
    }

    @Operation(summary = "Ẩn / khôi phục đánh giá vi phạm (ADMIN)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ReviewResponse>> updateStatus(
            @PathVariable String id,
            @RequestBody UpdateReviewStatusRequest request) {
        ReviewResponse response = reviewService.updateStatus(id, request);
        return ResponseEntity.ok(ApiResponse.<ReviewResponse>builder()
                .statusCode(200)
                .message("Status updated")
                .data(response)
                .build());
    }

    @Operation(summary = "Danh sách đánh giá của khách sạn (public)")
    @GetMapping("/hotel/{hotelId}")
    public ResponseEntity<ApiResponse<PageResponse<ReviewResponse>>> getHotelReviews(
            @PathVariable String hotelId,
            @RequestParam(defaultValue = "0")       int     page,
            @RequestParam(defaultValue = "10")      int     size,
            @Parameter(description = "newest | highest | lowest") @RequestParam(defaultValue = "newest") String sort,
            @Parameter(description = "Lọc theo số sao (1–5)") @RequestParam(required = false) Integer rating) {
        PageResponse<ReviewResponse> data = reviewService.getHotelReviews(hotelId, page, size, sort, rating);
        return ResponseEntity.ok(ApiResponse.<PageResponse<ReviewResponse>>builder()
                .statusCode(200)
                .message("Success")
                .data(data)
                .build());
    }
}
