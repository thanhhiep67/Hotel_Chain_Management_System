package com.example.Back_End.controller;

import com.example.Back_End.dto.request.CreateDiscountRequest;
import com.example.Back_End.dto.request.ValidateDiscountRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.DiscountResponse;
import com.example.Back_End.dto.response.ValidateDiscountResponse;
import com.example.Back_End.model.enums.DiscountStatus;
import com.example.Back_End.service.DiscountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/discounts")
@RequiredArgsConstructor
public class DiscountController {

    private final DiscountService discountService;

    /* ── OWNER / ADMIN manage ── */

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

    /* ── USER preview before booking ── */

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

    /* ── Public: active discounts for USER page ── */

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
