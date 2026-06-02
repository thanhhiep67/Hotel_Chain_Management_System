package com.example.Back_End.dto.request;

import lombok.Data;

@Data
public class MessageRequest {
    private String threadId;   // userId_hotelId
    private String content;
    private String bookingId;  // optional
    private String imageUrl;   // optional — ảnh đính kèm
    private String replyToId;  // optional — ID tin nhắn được trích dẫn
}
