package com.example.Back_End.model;

import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "bookings")
@CompoundIndexes({
    // Tối ưu kiểm tra xung đột: roomId + khoảng ngày
    @CompoundIndex(name = "idx_room_dates",   def = "{'roomId': 1, 'checkIn': 1, 'checkOut': 1}"),
    // Tối ưu getMyBookings: tránh in-memory sort theo createdAt
    @CompoundIndex(name = "idx_user_created", def = "{'userId': 1, 'createdAt': -1}")
})
public class Booking {

    @Id
    private String id;

    private String userId;   // covered by idx_user_created (leading field)

    private String roomId;   // covered by idx_room_dates (leading field)

    @Indexed
    private String hotelId;

    private String discountId;

    private LocalDate checkIn;

    private LocalDate checkOut;

    private Integer guestCount;

    private Double originalPrice;

    private Double discountAmount;

    private Double totalPrice;

    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING;

    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.UNPAID;

    private String specialRequests;

    private String cancelReason;

    private LocalDateTime confirmedAt;

    private LocalDateTime createdAt;
}
