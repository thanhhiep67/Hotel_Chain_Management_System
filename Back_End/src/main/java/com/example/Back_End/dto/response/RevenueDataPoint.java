package com.example.Back_End.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueDataPoint {
    private String period;        // "2024-01" (monthly) | "2024-W03" (weekly)
    private double revenue;
    private long   bookingCount;
}
