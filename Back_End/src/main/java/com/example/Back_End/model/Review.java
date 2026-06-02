package com.example.Back_End.model;

import com.example.Back_End.model.enums.ReviewStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "reviews")
@CompoundIndexes({
    // Lấy review của hotel theo trạng thái (trang public + moderation)
    @CompoundIndex(name = "idx_hotel_status", def = "{'hotelId': 1, 'status': 1}"),
})
public class Review {

    @Id
    private String id;

    /** Mỗi booking chỉ được review 1 lần */
    @Indexed(unique = true)
    private String bookingId;

    @Indexed
    private String userId;

    private String hotelId;   // covered by idx_hotel_status (leading field)

    /** 1–5 sao */
    private int overallRating;
    private int cleanlinessRating;
    private int serviceRating;
    private int locationRating;

    private String comment;

    /** Danh sách URL ảnh đính kèm (optional) */
    @Builder.Default
    private List<String> images = List.of();

    /** Phản hồi của chủ khách sạn (optional) */
    private String ownerReply;

    private LocalDateTime ownerRepliedAt;

    @Builder.Default
    private ReviewStatus status = ReviewStatus.PENDING;

    private LocalDateTime createdAt;
}
