package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.model.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private String id;
    private String fullName;
    private String email;
    private UserRole role;
    private UserStatus status;
    private String hotelId;
    private LocalDateTime createdAt;
}
