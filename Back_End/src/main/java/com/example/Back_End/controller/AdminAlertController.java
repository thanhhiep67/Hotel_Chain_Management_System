package com.example.Back_End.controller;

import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.ReviewAlertResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.ReviewAlert;
import com.example.Back_End.repository.ReviewAlertRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Tag(name = "Admin Alerts", description = "Cảnh báo đánh giá bất thường — dành cho ADMIN")
@RestController
@RequestMapping("/admin/review-alerts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAlertController {

    private final ReviewAlertRepository reviewAlertRepository;

    @Operation(summary = "Danh sách cảnh báo review (ADMIN)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping
    public ResponseEntity<ApiResponse<List<ReviewAlertResponse>>> getAlerts(
            @RequestParam(defaultValue = "false") boolean resolved) {
        List<ReviewAlertResponse> data = reviewAlertRepository
                .findByResolvedOrderByTriggeredAtDesc(resolved)
                .stream().map(this::toResponse)
                .collect(Collectors.toList());
        return ok(data);
    }

    @Operation(summary = "Đánh dấu cảnh báo đã xử lý (ADMIN)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<ReviewAlertResponse>> resolve(@PathVariable String id) {
        ReviewAlert alert = reviewAlertRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.INTERNAL_SERVER_ERROR));
        alert.setResolved(true);
        alert.setResolvedAt(LocalDateTime.now());
        return ok(toResponse(reviewAlertRepository.save(alert)));
    }

    private ReviewAlertResponse toResponse(ReviewAlert a) {
        return ReviewAlertResponse.builder()
                .id(a.getId())
                .userId(a.getUserId())
                .userFullName(a.getUserFullName())
                .userEmail(a.getUserEmail())
                .hotelId(a.getHotelId())
                .hotelName(a.getHotelName())
                .reviewIds(a.getReviewIds())
                .triggerReviewId(a.getTriggerReviewId())
                .triggeredAt(a.getTriggeredAt())
                .resolved(a.isResolved())
                .resolvedAt(a.getResolvedAt())
                .build();
    }

    private <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok(ApiResponse.<T>builder()
                .statusCode(200).message("Success").data(data).build());
    }
}
