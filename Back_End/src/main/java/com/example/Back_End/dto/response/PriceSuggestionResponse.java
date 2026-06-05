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
public class PriceSuggestionResponse {

    private double thisWeekOccupancy;
    private double avgPast4WeeksOccupancy;
    private double occupancyDelta;

    /** INCREASE | DECREASE | KEEP */
    private String action;
    private int    suggestedAdjustmentPct;
    private String reason;

    private List<WeekOccupancy> weeklyBreakdown;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeekOccupancy {
        private String label;
        private double occupancy;
    }
}
