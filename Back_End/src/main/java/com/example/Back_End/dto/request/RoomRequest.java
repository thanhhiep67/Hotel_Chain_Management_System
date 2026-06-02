package com.example.Back_End.dto.request;

import com.example.Back_End.model.enums.RoomType;
import lombok.Data;

import java.util.List;

@Data
public class RoomRequest {
    private String hotelId;
    private String roomNumber;
    private RoomType type;
    private Double pricePerNight;
    private Integer capacity;
    private String description;
    private List<String> amenities;
    private List<String> images;
}
