package com.example.Back_End.dto.response;

import com.example.Back_End.model.GeoLocation;
import com.example.Back_End.model.enums.HotelStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NearbyHotelResponse {
    private String id;
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
    private Double minPrice;
    /** Khoảng cách từ điểm tìm kiếm tới khách sạn, tính bằng km (làm tròn 2 chữ số) */
    private Double distanceKm;
}
