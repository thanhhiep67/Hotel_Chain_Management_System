package com.example.Back_End.controller;

import com.example.Back_End.dto.request.BookingRequest;
import com.example.Back_End.dto.request.QrScanRequest;
import com.example.Back_End.dto.request.ReasonRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.BookingResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.service.BookingService;
import com.example.Back_End.service.QrCodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@Tag(name = "Bookings", description = "Đặt phòng · xác nhận · thanh toán · check-in/out · QR")
@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final QrCodeService  qrCodeService;

    @Operation(summary = "Tạo booking mới (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<BookingResponse>> createBooking(
            @RequestBody BookingRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<BookingResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("Booking created successfully")
                        .data(bookingService.createBooking(email, request))
                        .build());
    }

    @Operation(summary = "Xác nhận booking (OWNER / STAFF)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/confirm")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    public ResponseEntity<ApiResponse<BookingResponse>> confirmBooking(
            @PathVariable String id,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Booking confirmed")
                .data(bookingService.confirmBooking(id, email))
                .build());
    }

    @Operation(summary = "Đánh dấu đã thanh toán (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/pay")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<BookingResponse>> payBooking(
            @PathVariable String id,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Payment confirmed")
                .data(bookingService.markAsPaid(id, email))
                .build());
    }

    @Operation(summary = "Hủy booking (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<BookingResponse>> cancelBooking(
            @PathVariable String id,
            @RequestBody ReasonRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Booking cancelled")
                .data(bookingService.cancelBooking(id, email, request))
                .build());
    }

    @Operation(summary = "Từ chối booking (OWNER / STAFF)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    public ResponseEntity<ApiResponse<BookingResponse>> rejectBooking(
            @PathVariable String id,
            @RequestBody ReasonRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Booking rejected")
                .data(bookingService.rejectBooking(id, email, request))
                .build());
    }

    @Operation(summary = "Check-in khách (STAFF / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/check-in")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<BookingResponse>> checkIn(
            @PathVariable String id,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Checked in successfully")
                .data(bookingService.checkIn(id, email))
                .build());
    }

    @Operation(summary = "Check-out khách (STAFF / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/check-out")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<BookingResponse>> checkOut(
            @PathVariable String id,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Checked out successfully")
                .data(bookingService.checkOut(id, email))
                .build());
    }

    @Operation(summary = "Danh sách booking của khách sạn (OWNER / STAFF)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/hotel/{hotelId}")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    public ResponseEntity<ApiResponse<PageResponse<BookingResponse>>> getBookingsByHotel(
            @PathVariable String hotelId,
            @Parameter(description = "Lọc theo trạng thái") @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) LocalDate checkIn,
            @RequestParam(required = false) LocalDate checkOut,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<PageResponse<BookingResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(bookingService.getBookingsByHotel(hotelId, email, status, checkIn, checkOut, page, size))
                .build());
    }

    @Operation(summary = "Chi tiết booking theo ID (STAFF / OWNER / USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER', 'USER')")
    public ResponseEntity<ApiResponse<BookingResponse>> getBookingById(
            @PathVariable String id,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(bookingService.getBookingById(id, email))
                .build());
    }

    @Operation(summary = "QR check-in của booking (USER) — trả về ảnh PNG", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping(value = "/{id}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<byte[]> getCheckInQr(
            @PathVariable String id,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.noStore())
                .body(qrCodeService.generateCheckInQr(id, email));
    }

    @Operation(summary = "Xác minh QR check-in (STAFF / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/verify-qr")
    @PreAuthorize("hasAnyRole('STAFF', 'OWNER')")
    public ResponseEntity<ApiResponse<BookingResponse>> scanQr(
            @RequestBody QrScanRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("QR verified successfully")
                .data(qrCodeService.scanQr(request.getPayload(), email))
                .build());
    }

    @Operation(summary = "Lịch sử booking của tôi (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/my")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<PageResponse<BookingResponse>>> getMyBookings(
            @Parameter(description = "Lọc theo trạng thái") @RequestParam(required = false) BookingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<PageResponse<BookingResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(bookingService.getMyBookings(email, status, page, size))
                .build());
    }
}
