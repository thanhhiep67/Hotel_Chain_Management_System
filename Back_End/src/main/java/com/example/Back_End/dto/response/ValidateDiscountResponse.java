package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.DiscountType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ValidateDiscountResponse {
    private String       discountId;
    private String       code;
    private DiscountType type;
    private double       value;
    private double       discountAmount;
    private double       finalPrice;
}
