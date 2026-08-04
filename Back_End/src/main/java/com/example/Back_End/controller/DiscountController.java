package com.example.Back_End.controller;

import com.example.Back_End.dto.request.CreateDiscountRequest;
import com.example.Back_End.dto.request.ValidateDiscountRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.DiscountResponse;
import com.example.Back_End.dto.response.ValidateDiscountResponse;
import com.example.Back_End.model.enums.DiscountStatus;
import com.example.Back_End.service.DiscountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Discounts", description = "Mã giảm giá — tạo, quản lý, áp dụng")
@RestController
@RequestMapping("/discounts")
@RequiredArgsConstructor
public class DiscountController {

    private final DiscountService discountService;

    @Operation(summary = "Tạo mã giảm giá mới (ADMIN / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<DiscountResponse>> create(
            @RequestBody CreateDiscountRequest request,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<DiscountResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("Discount created")
                        .data(discountService.createDiscount((String) auth.getPrincipal(), request))
                        .build());
    }

    @Operation(summary = "Cập nhật mã giảm giá (ADMIN / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<DiscountResponse>> update(
            @PathVariable String id,
            @RequestBody CreateDiscountRequest request,
            Authentication auth) {
        return ResponseEntity.ok(ApiResponse.<DiscountResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Discount updated")
                .data(discountService.updateDiscount(id, request, (String) auth.getPrincipal()))
                .build());
    }

    @Operation(summary = "Danh sách mã giảm giá của tôi (ADMIN / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<List<DiscountResponse>>> getMyDiscounts(
            @RequestParam(required = false) DiscountStatus status,
            Authentication auth) {
        return ResponseEntity.ok(ApiResponse.<List<DiscountResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(discountService.getDiscounts((String) auth.getPrincipal(), status))
                .build());
    }

    @Operation(summary = "Bật / tắt mã giảm giá (ADMIN / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<DiscountResponse>> toggle(
            @PathVariable String id, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.<DiscountResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Toggled")
                .data(discountService.toggleActive(id, (String) auth.getPrincipal()))
                .build());
    }

    @Operation(summary = "Xóa mã giảm giá (ADMIN / OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String id, Authentication auth) {
        discountService.deleteDiscount(id, (String) auth.getPrincipal());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Deleted")
                .build());
    }

    @Operation(summary = "Kiểm tra mã giảm giá trước khi đặt phòng (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/validate")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<ValidateDiscountResponse>> validate(
            @RequestBody ValidateDiscountRequest request) {
        return ResponseEntity.ok(ApiResponse.<ValidateDiscountResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Valid")
                .data(discountService.validate(request))
                .build());
    }

    @Operation(summary = "Danh sách mã đang hoạt động — trang khuyến mãi (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/active")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<List<DiscountResponse>>> getActive() {
        return ResponseEntity.ok(ApiResponse.<List<DiscountResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(discountService.getActiveDiscounts())
                .build());
    }
}
