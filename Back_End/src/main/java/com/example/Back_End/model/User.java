package com.example.Back_End.model;

import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.model.enums.UserStatus;
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
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String fullName;

    @Indexed(unique = true)
    private String email;

    private String password;

    private UserRole role;

    private UserStatus status;

    private String hotelId;

    private String refreshToken;

    private String avatarUrl;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
