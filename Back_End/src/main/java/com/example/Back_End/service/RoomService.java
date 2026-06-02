package com.example.Back_End.service;

import com.example.Back_End.dto.request.RoomRequest;
import com.example.Back_End.dto.response.DateRangeResponse;
import com.example.Back_End.dto.response.RoomResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.RoomType;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final HotelRepository hotelRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    @Caching(evict = {
        @CacheEvict(value = "hotels:detail",   key = "#request.hotelId"),
        @CacheEvict(value = "rooms:available", allEntries = true)
    })
    public RoomResponse createRoom(String ownerEmail, RoomRequest request) {
        Hotel hotel = hotelRepository.findById(request.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyOwnership(hotel, ownerEmail);

        if (roomRepository.existsByHotelIdAndRoomNumber(request.getHotelId(), request.getRoomNumber())) {
            throw new AppException(ErrorCode.ROOM_NUMBER_DUPLICATE);
        }

        Room room = Room.builder()
                .hotelId(request.getHotelId())
                .roomNumber(request.getRoomNumber())
                .type(request.getType())
                .pricePerNight(request.getPricePerNight())
                .capacity(request.getCapacity())
                .description(request.getDescription())
                .amenities(request.getAmenities() != null ? request.getAmenities() : new ArrayList<>())
                .images(request.getImages() != null ? request.getImages() : new ArrayList<>())
                .status(RoomStatus.AVAILABLE)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return toRoomResponse(roomRepository.save(room));
    }

    @Caching(evict = {
        @CacheEvict(value = "hotels:detail",   allEntries = true),
        @CacheEvict(value = "rooms:detail",    key = "#roomId"),
        @CacheEvict(value = "rooms:available", allEntries = true)
    })
    public RoomResponse updateRoom(String roomId, String ownerEmail, RoomRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_FOUND));

        if (room.getStatus() == RoomStatus.DELETED) {
            throw new AppException(ErrorCode.ROOM_ALREADY_DELETED);
        }

        Hotel hotel = hotelRepository.findById(room.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyOwnership(hotel, ownerEmail);

        if (!room.getRoomNumber().equals(request.getRoomNumber()) &&
                roomRepository.existsByHotelIdAndRoomNumberAndIdNot(room.getHotelId(), request.getRoomNumber(), roomId)) {
            throw new AppException(ErrorCode.ROOM_NUMBER_DUPLICATE);
        }

        room.setRoomNumber(request.getRoomNumber());
        room.setType(request.getType());
        room.setPricePerNight(request.getPricePerNight());
        room.setCapacity(request.getCapacity());
        room.setDescription(request.getDescription());
        room.setAmenities(request.getAmenities() != null ? request.getAmenities() : new ArrayList<>());
        room.setImages(request.getImages() != null ? request.getImages() : new ArrayList<>());
        room.setUpdatedAt(LocalDateTime.now());

        return toRoomResponse(roomRepository.save(room));
    }

    @Caching(evict = {
        @CacheEvict(value = "hotels:detail",   allEntries = true),
        @CacheEvict(value = "rooms:detail",    key = "#roomId"),
        @CacheEvict(value = "rooms:available", allEntries = true)
    })
    public void deleteRoom(String roomId, String ownerEmail) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_FOUND));

        if (room.getStatus() == RoomStatus.DELETED) {
            throw new AppException(ErrorCode.ROOM_ALREADY_DELETED);
        }

        Hotel hotel = hotelRepository.findById(room.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyOwnership(hotel, ownerEmail);

        // Soft delete — khi có Booking model, kiểm tra active booking trước
        room.setStatus(RoomStatus.DELETED);
        room.setUpdatedAt(LocalDateTime.now());
        roomRepository.save(room);
    }

    @Cacheable(value = "rooms:available", key = "{#hotelId, #checkIn, #checkOut, #type}")
    public List<RoomResponse> getAvailableRooms(String hotelId, LocalDate checkIn, LocalDate checkOut, RoomType type) {
        if (!checkIn.isBefore(checkOut)) {
            throw new AppException(ErrorCode.INVALID_DATE_RANGE);
        }

        List<Room> rooms = (type != null)
                ? roomRepository.findByHotelIdAndTypeAndStatus(hotelId, type, RoomStatus.AVAILABLE)
                : roomRepository.findByHotelIdAndStatus(hotelId, RoomStatus.AVAILABLE);

        if (rooms.isEmpty()) return List.of();

        List<String> roomIds = rooms.stream().map(Room::getId).toList();

        List<BookingStatus> nonBlocking = List.of(BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.CHECKED_OUT);
        Set<String> bookedRoomIds = bookingRepository
                .findByRoomIdInAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
                        roomIds, nonBlocking, checkOut, checkIn)
                .stream()
                .map(Booking::getRoomId)
                .collect(Collectors.toSet());

        return rooms.stream()
                .filter(r -> !bookedRoomIds.contains(r.getId()))
                .map(this::toRoomResponse)
                .toList();
    }

    private void verifyOwnership(Hotel hotel, String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (!hotel.getOwnerId().equals(owner.getId())) {
            throw new AppException(ErrorCode.HOTEL_NOT_OWNED);
        }
    }

    @Cacheable(value = "rooms:booked-dates", key = "#roomId")
    public List<DateRangeResponse> getBookedDates(String roomId) {
        roomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_FOUND));

        List<BookingStatus> activeStatuses = List.of(
                BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN);

        return bookingRepository.findByRoomIdAndStatusIn(roomId, activeStatuses)
                .stream()
                .map(b -> DateRangeResponse.builder()
                        .checkIn(b.getCheckIn())
                        .checkOut(b.getCheckOut())
                        .build())
                .toList();
    }

    @Cacheable(value = "rooms:detail", key = "#roomId")
    public RoomResponse getRoomById(String roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_FOUND));
        return toRoomResponse(room);
    }

    private RoomResponse toRoomResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .hotelId(room.getHotelId())
                .roomNumber(room.getRoomNumber())
                .type(room.getType())
                .pricePerNight(room.getPricePerNight())
                .capacity(room.getCapacity())
                .description(room.getDescription())
                .amenities(room.getAmenities())
                .images(room.getImages())
                .status(room.getStatus())
                .build();
    }
}
