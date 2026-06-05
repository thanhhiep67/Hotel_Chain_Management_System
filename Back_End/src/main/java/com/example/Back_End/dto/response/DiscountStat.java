package com.example.Back_End.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscountStat {
    private String discountId;
    private String code;
    private String name;
    private long   usageCount;
    private double totalDiscountAmount;
}
