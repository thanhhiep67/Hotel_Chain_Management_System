package com.example.Back_End.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GeoLocation {

    private String type = "Point";

    // [longitude, latitude] — thứ tự GeoJSON chuẩn
    private List<Double> coordinates;

    public static GeoLocation of(double longitude, double latitude) {
        return new GeoLocation("Point", List.of(longitude, latitude));
    }
}
