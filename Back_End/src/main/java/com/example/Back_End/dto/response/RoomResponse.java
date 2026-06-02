package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.RoomType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {
    private String id;
    private String hotelId;
    private String roomNumber;
    private RoomType type;
    private Double pricePerNight;
    private Integer capacity;
    private String description;
    private List<String> amenities;
    private List<String> images;
    private RoomStatus status;
}
