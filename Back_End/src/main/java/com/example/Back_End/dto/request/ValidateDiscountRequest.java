package com.example.Back_End.dto.request;

import lombok.Data;

@Data
public class ValidateDiscountRequest {
    private String code;
    private String hotelId;
    private double orderAmount;
}
