package com.example.Back_End.dto.response;

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
public class ReviewAlertResponse {
    private String          id;
    private String          userId;
    private String          userFullName;
    private String          userEmail;
    private String          hotelId;
    private String          hotelName;
    private List<String>    reviewIds;
    private String          triggerReviewId;
    private LocalDateTime   triggeredAt;
    private boolean         resolved;
    private LocalDateTime   resolvedAt;
}
