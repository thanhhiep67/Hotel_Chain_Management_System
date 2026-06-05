package com.example.Back_End.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "review_alerts")
public class ReviewAlert {

    @Id
    private String id;

    @Indexed
    private String userId;
    private String userFullName;
    private String userEmail;

    private String hotelId;
    private String hotelName;

    /** 3 reviewId gây ra cảnh báo (mới nhất cuối) */
    private List<String> reviewIds;

    /** Review thứ 3 — trigger cuối cùng */
    private String triggerReviewId;

    private LocalDateTime triggeredAt;

    @Builder.Default
    private boolean resolved = false;

    private LocalDateTime resolvedAt;
}
