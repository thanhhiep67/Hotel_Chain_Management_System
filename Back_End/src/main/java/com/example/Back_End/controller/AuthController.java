package com.example.Back_End.controller;

import com.example.Back_End.dto.request.ForgotPasswordRequest;
import com.example.Back_End.dto.request.LoginRequest;
import com.example.Back_End.dto.request.RefreshTokenRequest;
import com.example.Back_End.dto.request.RegisterRequest;
import com.example.Back_End.dto.request.ResetPasswordRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.LoginResponse;
import com.example.Back_End.dto.response.UserResponse;
import com.example.Back_End.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponse>> register(@RequestBody RegisterRequest request) {
        UserResponse userResponse = authService.register(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.<UserResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("User registered successfully")
                        .data(userResponse)
                        .build());
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@RequestBody LoginRequest request) {
        LoginResponse loginResponse = authService.login(request);
        return ResponseEntity.ok(ApiResponse.<LoginResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Login successful")
                .data(loginResponse)
                .build());
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(@RequestBody RefreshTokenRequest request) {
        LoginResponse loginResponse = authService.refresh(request);
        return ResponseEntity.ok(ApiResponse.<LoginResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Token refreshed successfully")
                .data(loginResponse)
                .build());
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody RefreshTokenRequest request) {
        authService.logout(request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Logout successful")
                .build());
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("OTP sent to your email")
                .build());
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Password reset successfully")
                .build());
    }
}
