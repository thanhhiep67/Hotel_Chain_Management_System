package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private String        id;
    private String        threadId;
    private String        userId;
    private String        hotelId;
    private String        bookingId;    // nullable
    private String        senderId;
    private UserRole      senderRole;
    private String        senderName;
    private String        content;
    private String        imageUrl;
    private String        replyToId;
    private String        replyToContent;
    private boolean       isRead;
    private boolean       isSystem;
    private LocalDateTime createdAt;
}
