package com.example.Back_End.controller;

import com.example.Back_End.dto.response.*;
import com.example.Back_End.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /** GET /analytics/overview?hotelId= */
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<OverviewResponse>> getOverview(
            @RequestParam String hotelId,
            Authentication auth) {
        return ok(analyticsService.getOverview(email(auth), hotelId));
    }

    /** GET /analytics/revenue?hotelId=&period=monthly&from=2024-01-01&to=2024-12-31 */
    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<List<RevenueDataPoint>>> getRevenue(
            @RequestParam String hotelId,
            @RequestParam(defaultValue = "monthly") String period,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getRevenue(email(auth), hotelId, period, from, to));
    }

    /** GET /analytics/bookings-by-status?hotelId=&from=&to= */
    @GetMapping("/bookings-by-status")
    public ResponseEntity<ApiResponse<List<BookingStatusStat>>> getBookingsByStatus(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getBookingsByStatus(email(auth), hotelId, from, to));
    }

    /** GET /analytics/top-rooms?hotelId=&from=&to= */
    @GetMapping("/top-rooms")
    public ResponseEntity<ApiResponse<List<TopRoomStat>>> getTopRooms(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getTopRooms(email(auth), hotelId, from, to));
    }

    /** GET /analytics/discounts?hotelId=&from=&to= */
    @GetMapping("/discounts")
    public ResponseEntity<ApiResponse<List<DiscountStat>>> getDiscountStats(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {
        return ok(analyticsService.getDiscountStats(email(auth), hotelId, from, to));
    }

    /** GET /analytics/forecast?hotelId= */
    @GetMapping("/forecast")
    public ResponseEntity<ApiResponse<BookingForecastResponse>> getForecast(
            @RequestParam String hotelId,
            Authentication auth) {
        return ok(analyticsService.getForecast(email(auth), hotelId));
    }

    /** GET /analytics/price-suggestion?hotelId= */
    @GetMapping("/price-suggestion")
    public ResponseEntity<ApiResponse<PriceSuggestionResponse>> getPriceSuggestion(
            @RequestParam String hotelId,
            Authentication auth) {
        return ok(analyticsService.getPriceSuggestion(email(auth), hotelId));
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private String email(Authentication auth) {
        return (String) auth.getPrincipal();
    }

    private <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok(ApiResponse.<T>builder()
                .statusCode(200).message("Success").data(data).build());
    }
}
