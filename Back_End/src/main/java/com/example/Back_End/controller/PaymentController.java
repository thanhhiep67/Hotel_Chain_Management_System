package com.example.Back_End.controller;

import com.example.Back_End.config.VNPayProperties;
import com.example.Back_End.dto.request.PaymentCreateRequest;
import com.example.Back_End.dto.request.RefundRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.PaymentResponse;
import com.example.Back_End.model.enums.PaymentStatus;
import com.example.Back_End.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Tag(name = "Payments", description = "Thanh toán VNPay · tiền mặt · hoàn tiền · lịch sử")
@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final VNPayProperties vnPayProps;

    @Operation(summary = "Tạo payment — hỗ trợ VNPay và tiền mặt (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/create")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> createPayment(
            @RequestBody PaymentCreateRequest request,
            HttpServletRequest httpRequest,
            Authentication authentication) {

        String userEmail = (String) authentication.getPrincipal();
        String ipAddr    = resolveClientIp(httpRequest);
        PaymentResponse data = paymentService.createPayment(userEmail, request, ipAddr);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<PaymentResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("Payment URL created")
                        .data(data)
                        .build());
    }

    @Operation(summary = "Tạo payment URL VNPay (USER) — legacy endpoint", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/vnpay/create")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<PaymentResponse>> createVNPayPayment(
            @RequestParam String bookingId,
            @RequestParam(required = false) String bankCode,
            @RequestParam(defaultValue = "vn") String locale,
            HttpServletRequest request,
            Authentication authentication) {

        String userEmail = (String) authentication.getPrincipal();
        String ipAddr    = resolveClientIp(request);
        PaymentResponse data = paymentService.createVNPayPayment(
                userEmail, bookingId, ipAddr, bankCode, locale);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<PaymentResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("Payment URL created")
                        .data(data)
                        .build());
    }

    @Operation(summary = "VNPay return URL — browser redirect sau khi thanh toán (public)")
    @GetMapping("/vnpay/return")
    public void vnpayReturn(
            @RequestParam Map<String, String> params,
            HttpServletResponse response) throws IOException {

        Map<String, String> ipnResult = paymentService.processCallback(params);
        boolean success = "00".equals(ipnResult.get("RspCode"))
                       || "02".equals(ipnResult.get("RspCode"));

        String paymentId = params.get("vnp_TxnRef");
        String redirectUrl = vnPayProps.getFrontendReturnUrl()
                + "?status=" + (success ? "SUCCESS" : "FAILED")
                + "&paymentId=" + paymentId;

        response.sendRedirect(redirectUrl);
    }

    @Operation(summary = "VNPay IPN — server-to-server callback (public)")
    @GetMapping("/vnpay/ipn")
    public Map<String, String> vnpayIpn(@RequestParam Map<String, String> params) {
        return paymentService.processCallback(params);
    }

    @Operation(summary = "Lịch sử thanh toán của tôi (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/my-payments")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<PageResponse<PaymentResponse>>> getMyPayments(
            @Parameter(description = "Lọc theo trạng thái") @RequestParam(required = false) PaymentStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {

        String userEmail = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<PageResponse<PaymentResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("OK")
                .data(paymentService.getMyPayments(userEmail, status, page, size))
                .build());
    }

    @Operation(summary = "Chi tiết payment theo ID (đã đăng nhập)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/{paymentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PaymentResponse>> getPayment(
            @PathVariable String paymentId,
            Authentication authentication) {

        boolean isPrivileged = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().matches("ROLE_ADMIN|ROLE_OWNER|ROLE_STAFF"));
        return ResponseEntity.ok(ApiResponse.<PaymentResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("OK")
                .data(paymentService.getById(paymentId, isPrivileged))
                .build());
    }

    @Operation(summary = "Danh sách payment theo bookingId (đã đăng nhập)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> getByBooking(
            @PathVariable String bookingId) {

        return ResponseEntity.ok(ApiResponse.<List<PaymentResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("OK")
                .data(paymentService.getByBookingId(bookingId))
                .build());
    }

    @Operation(summary = "Hoàn tiền qua VNPay (OWNER / ADMIN / STAFF)", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/{id}/refund")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN', 'STAFF')")
    public ResponseEntity<ApiResponse<PaymentResponse>> refundPayment(
            @PathVariable String id,
            @RequestBody(required = false) RefundRequest request,
            HttpServletRequest httpRequest,
            Authentication authentication) {

        String requesterEmail = (String) authentication.getPrincipal();
        String ipAddr         = resolveClientIp(httpRequest);
        String reason         = request != null ? request.getReason() : null;
        PaymentResponse data = paymentService.refundPayment(id, requesterEmail, reason, ipAddr);
        return ResponseEntity.ok(ApiResponse.<PaymentResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Payment refunded successfully")
                .data(data)
                .build());
    }

    private String resolveClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) ip = request.getRemoteAddr();
        if ("0:0:0:0:0:0:0:1".equals(ip)) ip = "127.0.0.1";
        return ip;
    }
}
