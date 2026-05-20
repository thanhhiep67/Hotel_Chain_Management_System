package com.example.Back_End.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "hotels")
public class Hotel {

    @Id
    private String id;
    private String name;
    private String address;
    private String city;
    private String country;
    private String phone;
    private String email;
    private int starRating;
    private String description;
}
