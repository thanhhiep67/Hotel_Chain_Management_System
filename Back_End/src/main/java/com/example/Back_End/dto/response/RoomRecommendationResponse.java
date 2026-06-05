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
public class RoomRecommendationResponse {
    private String roomId;
    private String hotelId;
    private String hotelName;
    private String hotelCity;
    private Double hotelAvgRating;
    private String hotelImage;
    private String roomNumber;
    private String type;
    private Double pricePerNight;
    private Integer capacity;
    private List<String> amenities;
    private List<String> images;
    private Double score;
}
