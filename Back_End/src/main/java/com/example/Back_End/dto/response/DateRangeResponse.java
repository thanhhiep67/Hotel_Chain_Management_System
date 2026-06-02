package com.example.Back_End.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class DateRangeResponse {
    private LocalDate checkIn;
    private LocalDate checkOut;
}
