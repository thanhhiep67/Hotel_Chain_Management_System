package com.example.Back_End.controller;

import com.example.Back_End.dto.request.OwnerReplyRequest;
import com.example.Back_End.dto.request.ReviewRequest;
import com.example.Back_End.dto.request.UpdateReviewStatusRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.ReviewResponse;
import com.example.Back_End.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /** POST /reviews — USER đã CHECKED_OUT mới được tạo */
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

    /** PATCH /reviews/{id}/reply — chỉ Owner của hotel đó */
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

    /** PATCH /reviews/{id}/status — chỉ ADMIN; ẩn hoặc khôi phục review */
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

    /** GET /reviews/hotel/{hotelId} — public; chỉ APPROVED; sort + phân trang */
    @GetMapping("/hotel/{hotelId}")
    public ResponseEntity<ApiResponse<PageResponse<ReviewResponse>>> getHotelReviews(
            @PathVariable String hotelId,
            @RequestParam(defaultValue = "0")       int     page,
            @RequestParam(defaultValue = "10")      int     size,
            @RequestParam(defaultValue = "newest")  String  sort,
            @RequestParam(required = false)         Integer rating) {
        PageResponse<ReviewResponse> data = reviewService.getHotelReviews(hotelId, page, size, sort, rating);
        return ResponseEntity.ok(ApiResponse.<PageResponse<ReviewResponse>>builder()
                .statusCode(200)
                .message("Success")
                .data(data)
                .build());
    }
}
