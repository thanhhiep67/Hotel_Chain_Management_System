package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.DiscountStatus;
import com.example.Back_End.model.enums.DiscountType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class DiscountResponse {
    private String         id;
    private String         code;
    private String         name;
    private DiscountType   type;
    private double         value;
    private double         minOrderAmount;
    private Double         maxDiscount;
    private Integer        usageLimit;
    private int            usedCount;
    private LocalDate      startDate;
    private LocalDate      endDate;
    private String         hotelId;
    private DiscountStatus status;
    private LocalDateTime  createdAt;
}
