package com.example.Back_End.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingStatusStat {
    private String status;   // tên enum dạng String để frontend dùng trực tiếp
    private long   count;
}
