package com.example.Back_End.dto.response;

import com.example.Back_End.model.GeoLocation;
import com.example.Back_End.model.enums.HotelStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HotelDetailResponse {
    private String id;
    private String ownerId;
    private String name;
    private String address;
    private String city;
    private String description;
    private GeoLocation location;
    private List<String> amenities;
    private List<String> images;
    private HotelStatus status;
    private Double avgRating;
    private Integer reviewCount;
    private LocalDateTime createdAt;
    private List<RoomResponse> rooms;
}
