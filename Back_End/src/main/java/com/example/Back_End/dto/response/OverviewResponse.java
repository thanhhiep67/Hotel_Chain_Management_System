package com.example.Back_End.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OverviewResponse {
    private long   totalBookings;        // tất cả booking mọi thời điểm
    private double revenueThisMonth;     // PAID bookings tháng này
    private double occupancyRate;        // % phòng đang CHECKED_IN / tổng phòng
    private double avgRating;
    private int    reviewCount;
    private int    totalRooms;
}
