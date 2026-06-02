package com.example.Back_End.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class NotificationResponse {
    private String id;
    private String type;
    private String title;
    private String message;
    private String referenceId;
    private String referenceType;
    private String hotelId;
    @JsonProperty("isRead")
    private boolean isRead;
    private LocalDateTime createdAt;
}
