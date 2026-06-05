package com.example.Back_End.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingForecastResponse {

    /** 4 tuần hoàn chỉnh gần nhất, từ cũ → mới */
    private List<WeekStat> history;

    /** Tuần hiện tại (đang diễn ra, có thể chưa đủ) */
    private WeekStat thisWeek;

    /** MA = round(avg 4 tuần) */
    private long   forecastCount;
    private double movingAverage;

    /** Khoảng dự báo: "09/06 – 15/06" */
    private String forecastWeek;

    /** UP | DOWN | STABLE — so với tuần gần nhất */
    private String trend;
    private double trendPct;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeekStat {
        private String label;      // "1 tuần trước", "Tuần này", …
        private String dateRange;  // "26/05 – 01/06"
        private long   count;
    }
}
