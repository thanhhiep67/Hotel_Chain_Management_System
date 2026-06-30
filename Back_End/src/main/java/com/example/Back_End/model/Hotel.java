package com.example.Back_End.model;

import com.example.Back_End.model.enums.HotelStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "hotels")
@CompoundIndexes({
    @CompoundIndex(name = "city_status_rating", def = "{'city': 1, 'status': 1, 'avgRating': -1}"),
    @CompoundIndex(name = "owner_status", def = "{'ownerId': 1, 'status': 1}")
})
public class Hotel {

    @Id
    private String id;

    @Indexed
    private String ownerId;

    private String name;

    private String address;

    @Indexed
    private String city;

    /** Normalized (no-accent, lowercase) version of city for fuzzy search */
    @Indexed
    private String citySlug;

    private String description;

    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoLocation location;

    @Builder.Default
    private List<String> amenities = new ArrayList<>();

    @Builder.Default
    private List<String> images = new ArrayList<>();

    @Indexed
    @Builder.Default
    private HotelStatus status = HotelStatus.PENDING;

    @Indexed
    @Builder.Default
    private Double avgRating = 0.0;

    @Builder.Default
    private Integer reviewCount = 0;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
