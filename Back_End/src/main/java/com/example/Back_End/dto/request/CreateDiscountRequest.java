package com.example.Back_End.dto.request;

import com.example.Back_End.model.enums.DiscountType;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateDiscountRequest {
    private String      code;
    private String      name;
    private DiscountType type;
    private double      value;
    private double      minOrderAmount;
    private Double      maxDiscount;   // cap for PERCENTAGE, null = no cap
    private Integer     usageLimit;   // null = unlimited
    private LocalDate   startDate;
    private LocalDate   endDate;
    private String      hotelId;      // null = all hotels
}
