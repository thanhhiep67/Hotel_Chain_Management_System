package com.example.Back_End.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "password_reset_otps")
public class PasswordResetOtp {

    @Id
    private String id;

    private String email;

    private String otp;

    @Indexed(expireAfter = "5m")
    private LocalDateTime createdAt;
}
