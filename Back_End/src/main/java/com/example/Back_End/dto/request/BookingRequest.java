package com.example.Back_End.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookingRequest {
    private String    roomId;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Integer   guestCount;
    private String    specialRequests;
    private String    discountCode;
}
