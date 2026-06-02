package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.PaymentStatus;
import com.example.Back_End.model.enums.RoomType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {
    private String id;
    private String userId;
    private String roomId;
    private String hotelId;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Integer guestCount;
    private String        discountId;
    private Double        originalPrice;
    private Double        discountAmount;
    private Double        totalPrice;
    private BookingStatus status;
    private PaymentStatus paymentStatus;
    private String        specialRequests;
    private String        cancelReason;
    private LocalDateTime confirmedAt;
    private LocalDateTime createdAt;

    // Denormalized for display
    private String hotelName;
    private String hotelAddress;
    private String hotelCity;
    private String roomNumber;
    private RoomType roomType;
    private Double pricePerNight;

    // Guest info — populated for staff/owner lookup endpoints
    private String guestName;
    private String guestEmail;
}
