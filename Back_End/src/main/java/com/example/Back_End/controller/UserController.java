package com.example.Back_End.controller;

import com.example.Back_End.dto.request.UpdateStatusRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.UserResponse;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.model.enums.UserStatus;
import com.example.Back_End.service.UserService;
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

@Tag(name = "Users", description = "Quản lý người dùng (ADMIN) · thông tin cá nhân")
@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "Danh sách tất cả user (ADMIN)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<UserResponse>>> getAllUsers(
            @Parameter(description = "Lọc theo role") @RequestParam(required = false) UserRole role,
            @Parameter(description = "Lọc theo trạng thái") @RequestParam(required = false) UserStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.<PageResponse<UserResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(userService.getAllUsers(role, status, page, size))
                .build());
    }

    @Operation(summary = "Chi tiết một user theo ID (ADMIN)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(userService.getUserById(id))
                .build());
    }

    @Operation(summary = "Cập nhật trạng thái user — khóa / mở khóa (ADMIN)", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping("/admin/users/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> updateStatus(
            @PathVariable String id,
            @RequestBody UpdateStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("User status updated")
                .data(userService.updateStatus(id, request))
                .build());
    }

    @Operation(summary = "Xóa tài khoản user (ADMIN)", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("User deleted")
                .build());
    }

    @Operation(summary = "Thông tin tài khoản đang đăng nhập", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/users/me")
    @PreAuthorize("hasAnyRole('ADMIN', 'OWNER', 'STAFF', 'USER')")
    public ResponseEntity<ApiResponse<UserResponse>> getMe(Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(userService.getMe(email))
                .build());
    }
}
