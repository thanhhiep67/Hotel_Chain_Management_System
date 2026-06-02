package com.example.Back_End.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document("notifications")
public class Notification {

    @Id
    private String id;

    /** userId cho USER, hotelId cho OWNER/STAFF */
    @Indexed
    private String recipientId;

    /** BOOKING_CONFIRMED | BOOKING_REJECTED | BOOKING_CREATED | BOOKING_CANCELLED */
    private String type;

    private String title;
    private String message;

    /** bookingId */
    private String referenceId;

    /** luôn là "BOOKING" hiện tại */
    private String referenceType;

    /** dùng để filter notification đúng hotel trên HotelBookingsPage */
    private String hotelId;

    @Builder.Default
    private boolean isRead = false;

    /** TTL index — MongoDB tự xóa sau 30 ngày */
    @Indexed(expireAfter = "P30D")
    private LocalDateTime createdAt;
}
