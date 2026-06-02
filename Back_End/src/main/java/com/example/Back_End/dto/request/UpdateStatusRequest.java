package com.example.Back_End.dto.request;

import com.example.Back_End.model.enums.UserStatus;
import lombok.Data;

@Data
public class UpdateStatusRequest {
    private UserStatus status;
}
