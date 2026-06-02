package com.example.Back_End.service;

import com.example.Back_End.dto.request.AssignStaffRequest;
import com.example.Back_End.dto.request.HotelRequest;
import com.example.Back_End.dto.request.UpdateHotelStatusRequest;
import com.example.Back_End.dto.response.HotelDetailResponse;
import com.example.Back_End.dto.response.HotelResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.RoomResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.GeoLocation;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.HotelStatus;
import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.RoomType;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class HotelService {

    private final HotelRepository hotelRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public void assignStaff(String hotelId, String ownerEmail, AssignStaffRequest request) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!hotel.getOwnerId().equals(owner.getId())) {
            throw new AppException(ErrorCode.HOTEL_NOT_OWNED);
        }

        User staff = userRepository.findById(request.getStaffId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (staff.getRole() != UserRole.STAFF) {
            throw new AppException(ErrorCode.INVALID_STAFF);
        }

        staff.setHotelId(hotelId);
        staff.setUpdatedAt(LocalDateTime.now());
        userRepository.save(staff);
    }

    public List<HotelResponse> getMyHotels(String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return hotelRepository.findByOwnerId(owner.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Cacheable(value = "hotels:detail", key = "#hotelId")
    public HotelDetailResponse getHotelById(String hotelId) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        List<RoomResponse> rooms = roomRepository.findByHotelId(hotelId)
                .stream()
                .filter(r -> r.getStatus() != RoomStatus.DELETED)
                .map(this::toRoomResponse)
                .toList();

        return HotelDetailResponse.builder()
                .id(hotel.getId())
                .ownerId(hotel.getOwnerId())
                .name(hotel.getName())
                .address(hotel.getAddress())
                .city(hotel.getCity())
                .description(hotel.getDescription())
                .location(hotel.getLocation())
                .amenities(hotel.getAmenities())
                .images(hotel.getImages())
                .status(hotel.getStatus())
                .avgRating(hotel.getAvgRating())
                .reviewCount(hotel.getReviewCount())
                .createdAt(hotel.getCreatedAt())
                .rooms(rooms)
                .build();
    }

    @Cacheable(value = "hotels:search", key = "{#city, #roomType, #minPrice, #maxPrice, #page, #size}")
    public PageResponse<HotelResponse> searchHotels(String city, RoomType roomType,
                                                     Double minPrice, Double maxPrice,
                                                     int page, int size) {
        // Bước 1: tìm hotelId có phòng AVAILABLE khớp type/price
        Criteria roomCriteria = Criteria.where("status").is(RoomStatus.AVAILABLE);
        if (roomType != null) roomCriteria = roomCriteria.and("type").is(roomType);
        if (minPrice != null) roomCriteria = roomCriteria.and("pricePerNight").gte(minPrice);
        if (maxPrice != null) roomCriteria = roomCriteria.and("pricePerNight").lte(maxPrice);

        List<String> matchingHotelIds = mongoTemplate.findDistinct(
                Query.query(roomCriteria), "hotelId", Room.class, String.class);

        // Bước 2: query hotels APPROVED + filter city + chỉ hotel có phòng khớp
        Criteria hotelCriteria = Criteria.where("status").is(HotelStatus.APPROVED);
        if (city != null && !city.isBlank()) {
            hotelCriteria = hotelCriteria.and("city").regex(city.trim(), "i");
        }
        if (roomType != null || minPrice != null || maxPrice != null) {
            if (matchingHotelIds.isEmpty()) {
                return PageResponse.<HotelResponse>builder()
                        .content(List.of()).page(page).size(size)
                        .totalElements(0).totalPages(0).build();
            }
            hotelCriteria = hotelCriteria.and("id").in(matchingHotelIds);
        }

        Query countQuery = Query.query(hotelCriteria);
        long total = mongoTemplate.count(countQuery, Hotel.class);

        Query dataQuery = Query.query(hotelCriteria)
                .with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "avgRating")));
        List<HotelResponse> content = mongoTemplate.find(dataQuery, Hotel.class)
                .stream().map(this::toResponse).toList();

        return PageResponse.<HotelResponse>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages((int) Math.ceil((double) total / size))
                .build();
    }

    @Caching(evict = {
        @CacheEvict(value = "hotels:search", allEntries = true),
        @CacheEvict(value = "hotels:admin",  allEntries = true)
    })
    public HotelResponse createHotel(String ownerEmail, HotelRequest request) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        GeoLocation location = null;
        if (request.getLongitude() != null && request.getLatitude() != null) {
            location = GeoLocation.of(request.getLongitude(), request.getLatitude());
        }

        Hotel hotel = Hotel.builder()
                .ownerId(owner.getId())
                .name(request.getName())
                .address(request.getAddress())
                .city(request.getCity())
                .description(request.getDescription())
                .amenities(request.getAmenities() != null ? request.getAmenities() : List.of())
                .images(request.getImages() != null ? request.getImages() : List.of())
                .location(location)
                .status(HotelStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        return toResponse(hotelRepository.save(hotel));
    }

    @Caching(evict = {
        @CacheEvict(value = "hotels:detail", key = "#hotelId"),
        @CacheEvict(value = "hotels:search", allEntries = true),
        @CacheEvict(value = "hotels:admin",  allEntries = true)
    })
    public HotelResponse updateHotel(String hotelId, String requesterEmail, String requesterRole, HotelRequest request) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        if ("OWNER".equals(requesterRole)) {
            User owner = userRepository.findByEmail(requesterEmail)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            if (!hotel.getOwnerId().equals(owner.getId())) {
                throw new AppException(ErrorCode.HOTEL_NOT_OWNED);
            }
        }

        if (request.getName() != null) hotel.setName(request.getName());
        if (request.getAddress() != null) hotel.setAddress(request.getAddress());
        if (request.getCity() != null) hotel.setCity(request.getCity());
        if (request.getDescription() != null) hotel.setDescription(request.getDescription());
        if (request.getAmenities() != null) hotel.setAmenities(request.getAmenities());
        if (request.getImages() != null) hotel.setImages(request.getImages());
        if (request.getLongitude() != null && request.getLatitude() != null) {
            hotel.setLocation(GeoLocation.of(request.getLongitude(), request.getLatitude()));
        }
        hotel.setUpdatedAt(LocalDateTime.now());

        return toResponse(hotelRepository.save(hotel));
    }

    @Caching(evict = {
        @CacheEvict(value = "hotels:detail", key = "#hotelId"),
        @CacheEvict(value = "hotels:search", allEntries = true),
        @CacheEvict(value = "hotels:admin",  allEntries = true)
    })
    public void deleteHotel(String hotelId, String requesterEmail, String requesterRole) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        if ("OWNER".equals(requesterRole)) {
            User owner = userRepository.findByEmail(requesterEmail)
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            if (!hotel.getOwnerId().equals(owner.getId())) {
                throw new AppException(ErrorCode.HOTEL_NOT_OWNED);
            }
        }

        hotel.setStatus(HotelStatus.INACTIVE);
        hotel.setUpdatedAt(LocalDateTime.now());
        hotelRepository.save(hotel);
    }

    @Cacheable(value = "hotels:admin", key = "{#status, #page, #size}")
    public PageResponse<HotelResponse> getAllHotelsAdmin(HotelStatus status, int page, int size) {
        Criteria criteria = status != null
                ? Criteria.where("status").is(status)
                : new Criteria();

        long total = mongoTemplate.count(Query.query(criteria), Hotel.class);

        Query dataQuery = Query.query(criteria)
                .with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<HotelResponse> content = mongoTemplate.find(dataQuery, Hotel.class)
                .stream().map(this::toResponse).toList();

        return PageResponse.<HotelResponse>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages((int) Math.ceil((double) total / size))
                .build();
    }

    @Caching(evict = {
        @CacheEvict(value = "hotels:detail", key = "#hotelId"),
        @CacheEvict(value = "hotels:search", allEntries = true),
        @CacheEvict(value = "hotels:admin",  allEntries = true)
    })
    public HotelResponse updateStatus(String hotelId, UpdateHotelStatusRequest request) {
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        hotel.setStatus(request.getStatus());
        hotel.setUpdatedAt(LocalDateTime.now());

        return toResponse(hotelRepository.save(hotel));
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

    private HotelResponse toResponse(Hotel hotel) {
        return HotelResponse.builder()
                .id(hotel.getId())
                .ownerId(hotel.getOwnerId())
                .name(hotel.getName())
                .address(hotel.getAddress())
                .city(hotel.getCity())
                .description(hotel.getDescription())
                .location(hotel.getLocation())
                .amenities(hotel.getAmenities())
                .images(hotel.getImages())
                .status(hotel.getStatus())
                .avgRating(hotel.getAvgRating())
                .reviewCount(hotel.getReviewCount())
                .createdAt(hotel.getCreatedAt())
                .build();
    }
}
