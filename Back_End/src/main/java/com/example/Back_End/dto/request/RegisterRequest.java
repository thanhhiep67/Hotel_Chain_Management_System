package com.example.Back_End.dto.request;

import com.example.Back_End.model.enums.UserRole;
import lombok.Data;

@Data
public class RegisterRequest {
    private String fullName;
    private String email;
    private String password;
    private UserRole role;
}
