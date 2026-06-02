package com.example.Back_End.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThreadSummaryResponse {
    private String        threadId;
    private String        hotelId;
    private String        hotelName;
    private String        userId;
    private String        userName;
    private String        lastMessage;
    private LocalDateTime lastMessageAt;
    private long          unreadCount;
}
