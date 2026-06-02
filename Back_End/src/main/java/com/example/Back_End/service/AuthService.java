package com.example.Back_End.service;

import com.example.Back_End.dto.request.ForgotPasswordRequest;
import com.example.Back_End.dto.request.LoginRequest;
import com.example.Back_End.dto.request.RefreshTokenRequest;
import com.example.Back_End.dto.request.RegisterRequest;
import com.example.Back_End.dto.request.ResetPasswordRequest;
import com.example.Back_End.dto.response.LoginResponse;
import com.example.Back_End.dto.response.UserResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.PasswordResetOtp;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.UserStatus;
import com.example.Back_End.repository.PasswordResetOtpRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PasswordResetOtpRepository otpRepository;
    private final EmailService emailService;

    private static final SecureRandom RANDOM = new SecureRandom();

    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .status(UserStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();

        User saved = userRepository.save(user);
        return toUserResponse(saved);
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .user(toUserResponse(user))
                .build();
    }

    public LoginResponse refresh(RefreshTokenRequest request) {
        String token = request.getRefreshToken();

        if (!jwtService.isTokenValid(token)) {
            throw new AppException(ErrorCode.INVALID_TOKEN);
        }

        String email = jwtService.extractEmail(token);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_TOKEN));

        if (!token.equals(user.getRefreshToken())) {
            throw new AppException(ErrorCode.INVALID_TOKEN);
        }

        String newAccessToken = jwtService.generateAccessToken(user);
        String newRefreshToken = jwtService.generateRefreshToken(user);

        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .user(toUserResponse(user))
                .build();
    }

    public void forgotPassword(ForgotPasswordRequest request) {
        if (!userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        otpRepository.deleteByEmail(request.getEmail());

        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));

        otpRepository.save(PasswordResetOtp.builder()
                .email(request.getEmail())
                .otp(otp)
                .createdAt(LocalDateTime.now())
                .build());

        emailService.sendOtpEmail(request.getEmail(), otp);
    }

    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetOtp otpRecord = otpRepository
                .findByEmailAndOtp(request.getEmail(), request.getOtp())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_OTP));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        otpRepository.delete(otpRecord);
    }

    public void logout(RefreshTokenRequest request) {
        String token = request.getRefreshToken();

        String email = jwtService.extractEmail(token);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_TOKEN));

        if (!token.equals(user.getRefreshToken())) {
            throw new AppException(ErrorCode.INVALID_TOKEN);
        }

        user.setRefreshToken(null);
        userRepository.save(user);
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus())
                .hotelId(user.getHotelId())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
