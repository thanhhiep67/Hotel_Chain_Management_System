package com.example.Back_End.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopRoomStat {
    private String roomId;
    private String roomNumber;
    private String roomType;
    private long   bookingCount;
    private double totalRevenue;
}
