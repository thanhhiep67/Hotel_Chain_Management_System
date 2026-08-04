package com.example.Back_End.controller;

import com.example.Back_End.dto.response.*;
import com.example.Back_End.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Tag(name = "Analytics (OWNER)", description = "Thống kê doanh thu · booking · phòng · dự báo")
@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @Operation(summary = "Tổng quan: doanh thu, booking, đánh giá (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<OverviewResponse>> getOverview(
            @RequestParam String hotelId,
            Authentication auth) {
        return ok(analyticsService.getOverview(email(auth), hotelId));
    }

    @Operation(summary = "Doanh thu theo khoảng thời gian (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<List<RevenueDataPoint>>> getRevenue(
            @RequestParam String hotelId,
            @Parameter(description = "daily | weekly | monthly") @RequestParam(defaultValue = "monthly") String period,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getRevenue(email(auth), hotelId, period, from, to));
    }

    @Operation(summary = "Phân bổ booking theo trạng thái (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/bookings-by-status")
    public ResponseEntity<ApiResponse<List<BookingStatusStat>>> getBookingsByStatus(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getBookingsByStatus(email(auth), hotelId, from, to));
    }

    @Operation(summary = "Top phòng được đặt nhiều nhất (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/top-rooms")
    public ResponseEntity<ApiResponse<List<TopRoomStat>>> getTopRooms(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getTopRooms(email(auth), hotelId, from, to));
    }

    @Operation(summary = "Thống kê hiệu quả mã giảm giá (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/discounts")
    public ResponseEntity<ApiResponse<List<DiscountStat>>> getDiscountStats(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getDiscountStats(email(auth), hotelId, from, to));
    }

    @Operation(summary = "Dự báo lượng booking 30 ngày tới (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/forecast")
    public ResponseEntity<ApiResponse<BookingForecastResponse>> getForecast(
            @RequestParam String hotelId,
            Authentication auth) {
        return ok(analyticsService.getForecast(email(auth), hotelId));
    }

    @Operation(summary = "Phân bổ phương thức thanh toán (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/payment-methods")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPaymentMethodBreakdown(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getPaymentMethodBreakdown(email(auth), hotelId, from, to));
    }

    @Operation(summary = "Gợi ý giá phòng tối ưu theo AI (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/price-suggestion")
    public ResponseEntity<ApiResponse<PriceSuggestionResponse>> getPriceSuggestion(
            @RequestParam String hotelId,
            Authentication auth) {
        return ok(analyticsService.getPriceSuggestion(email(auth), hotelId));
    }

    private String email(Authentication auth) {
        return (String) auth.getPrincipal();
    }

    private <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok(ApiResponse.<T>builder()
                .statusCode(200).message("Success").data(data).build());
    }
}
