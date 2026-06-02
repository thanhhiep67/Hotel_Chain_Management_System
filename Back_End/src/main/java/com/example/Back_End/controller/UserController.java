package com.example.Back_End.controller;

import com.example.Back_End.dto.request.UpdateStatusRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.UserResponse;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.model.enums.UserStatus;
import com.example.Back_End.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // ADMIN: xem toàn bộ danh sách user
    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<UserResponse>>> getAllUsers(
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.<PageResponse<UserResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(userService.getAllUsers(role, status, page, size))
                .build());
    }

    // ADMIN: xem chi tiết 1 user bất kỳ
    @GetMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(userService.getUserById(id))
                .build());
    }

    // ADMIN: khóa / mở khóa / đổi trạng thái user
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

    // ADMIN: xóa tài khoản
    @DeleteMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("User deleted")
                .build());
    }

    // Tất cả role: xem thông tin bản thân
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
