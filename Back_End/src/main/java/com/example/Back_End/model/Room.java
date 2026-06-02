package com.example.Back_End.model;

import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.RoomType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "rooms")
@CompoundIndexes({
    @CompoundIndex(name = "hotel_room_unique", def = "{'hotelId': 1, 'roomNumber': 1}", unique = true),
    @CompoundIndex(name = "hotel_type_status_price", def = "{'hotelId': 1, 'type': 1, 'status': 1, 'pricePerNight': 1}")
})
public class Room {

    @Id
    private String id;

    @Indexed
    private String hotelId;

    private String roomNumber;

    @Indexed
    private RoomType type;

    @Indexed
    private Double pricePerNight;

    private Integer capacity;

    private String description;

    @Builder.Default
    private List<String> amenities = new ArrayList<>();

    @Builder.Default
    private List<String> images = new ArrayList<>();

    @Indexed
    @Builder.Default
    private RoomStatus status = RoomStatus.AVAILABLE;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
