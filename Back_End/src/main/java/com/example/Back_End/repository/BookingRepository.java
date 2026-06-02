package com.example.Back_End.repository;

import com.example.Back_End.model.Booking;
import com.example.Back_End.model.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface BookingRepository extends MongoRepository<Booking, String> {

    // Kiểm tra xung đột: newStart < existEnd AND newEnd > existStart
    //                     AND status NOT IN [CANCELLED, REJECTED]
    boolean existsByRoomIdAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
            String roomId,
            List<BookingStatus> excludedStatuses,
            LocalDate checkOut,   // existEnd > newStart  →  checkIn < checkOut (của request)
            LocalDate checkIn     // existStart < newEnd  →  checkOut > checkIn (của request)
    );

    // Dùng cho getAvailableRooms — loại nhiều room cùng lúc
    List<Booking> findByRoomIdInAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
            List<String> roomIds,
            List<BookingStatus> excludedStatuses,
            LocalDate checkOut,
            LocalDate checkIn
    );

    List<Booking> findByUserIdOrderByCreatedAtDesc(String userId);

    Page<Booking> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    Page<Booking> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, BookingStatus status, Pageable pageable);

    List<Booking> findByRoomIdAndStatusIn(String roomId, List<BookingStatus> statuses);

    @Query("{ 'checkIn': ?0, 'status': { $in: ?1 } }")
    List<Booking> findByCheckInDateAndStatusIn(LocalDate checkIn, List<BookingStatus> statuses);
}
