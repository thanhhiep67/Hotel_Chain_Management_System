package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.ReviewStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewResponse {

    private String id;
    private String bookingId;
    private String userId;
    private String hotelId;

    // Denormalized để frontend không cần gọi thêm
    private String userName;
    private String hotelName;

    private int overallRating;
    private int cleanlinessRating;
    private int serviceRating;
    private int locationRating;

    private String      comment;
    private List<String> images;

    private String        ownerReply;
    private LocalDateTime ownerRepliedAt;

    private ReviewStatus  status;
    private LocalDateTime createdAt;
}
