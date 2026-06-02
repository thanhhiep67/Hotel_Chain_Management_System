package com.example.Back_End.repository;

import com.example.Back_End.model.PasswordResetOtp;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PasswordResetOtpRepository extends MongoRepository<PasswordResetOtp, String> {

    Optional<PasswordResetOtp> findByEmailAndOtp(String email, String otp);

    void deleteByEmail(String email);
}
