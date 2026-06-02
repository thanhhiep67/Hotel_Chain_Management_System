package com.example.Back_End.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class HotelRequest {
    private String name;
    private String address;
    private String city;
    private String description;
    private List<String> amenities;
    private List<String> images;
    private Double longitude;
    private Double latitude;
}
