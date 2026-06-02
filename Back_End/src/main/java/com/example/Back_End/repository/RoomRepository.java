package com.example.Back_End.repository;

import com.example.Back_End.model.Room;
import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.RoomType;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface RoomRepository extends MongoRepository<Room, String> {

    List<Room> findByHotelId(String hotelId);

    List<Room> findByHotelIdAndStatus(String hotelId, RoomStatus status);

    List<Room> findByHotelIdAndTypeAndStatus(String hotelId, RoomType type, RoomStatus status);

    boolean existsByHotelIdAndRoomNumber(String hotelId, String roomNumber);

    boolean existsByHotelIdAndRoomNumberAndIdNot(String hotelId, String roomNumber, String id);
}
