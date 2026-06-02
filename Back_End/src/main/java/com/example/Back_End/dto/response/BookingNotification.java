package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.BookingStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class BookingNotification {
    private String eventType;   // BOOKING_CREATED | BOOKING_CONFIRMED | BOOKING_REJECTED | ...
    private String bookingId;
    private String hotelId;
    private String roomId;
    private String roomNumber;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Integer guestCount;
    private Double totalPrice;
    private BookingStatus status;
    private String cancelReason;
    private LocalDateTime createdAt;
}
