package com.example.Back_End.service;

import com.example.Back_End.dto.response.RoomRecommendationResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.HotelStatus;
import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.RoomType;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final UserRepository     userRepository;
    private final BookingRepository  bookingRepository;
    private final RoomRepository     roomRepository;
    private final HotelRepository    hotelRepository;
    private final MongoTemplate      mongoTemplate;

    private static final List<BookingStatus> HISTORY_STATUSES = List.of(
            BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT
    );

    // ── CBF feature weights ───────────────────────────────────────────────
    private static final double W_TYPE   = 0.50;
    private static final double W_PRICE  = 0.35;
    private static final double W_RATING = 0.15;

    // ── Hybrid blend weights ──────────────────────────────────────────────
    private static final double W_HYBRID_CBF = 0.40;
    private static final double W_HYBRID_CF  = 0.60;

    @Cacheable(value = "rec:cbf", key = "#userEmail")
    public List<RoomRecommendationResponse> getRecommendations(String userEmail, int size) {
        String userId = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND)).getId();

        List<Booking> history = bookingRepository
                .findByUserIdAndStatusIn(userId, HISTORY_STATUSES);

        if (history.isEmpty()) {
            return coldStart(size);
        }

        // ── 1. Build preference profile ───────────────────────────────────

        Set<String> bookedRoomIds = history.stream()
                .map(Booking::getRoomId).collect(Collectors.toSet());

        // Fetch historic rooms to get their types
        Map<String, Room> historicRoomMap = roomRepository.findAllById(bookedRoomIds)
                .stream().collect(Collectors.toMap(Room::getId, r -> r));

        // type frequency: how many bookings per room type
        Map<RoomType, Long> typeFrequency = history.stream()
                .map(b -> historicRoomMap.get(b.getRoomId()))
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Room::getType, Collectors.counting()));

        long totalTyped = typeFrequency.values().stream().mapToLong(Long::longValue).sum();

        // avg price per night across history
        double avgPricePerNight = history.stream()
                .filter(b -> b.getTotalPrice() != null
                        && b.getCheckIn() != null
                        && b.getCheckOut() != null)
                .mapToDouble(b -> {
                    long nights = ChronoUnit.DAYS.between(b.getCheckIn(), b.getCheckOut());
                    return nights > 0 ? b.getTotalPrice() / nights : b.getTotalPrice();
                })
                .average()
                .orElse(500_000.0);

        // ── 2. Candidate rooms: AVAILABLE + not already booked ────────────

        Query candidateQuery = Query.query(
                Criteria.where("status").is(RoomStatus.AVAILABLE.name())
                        .and("_id").nin(bookedRoomIds)
        );
        List<Room> candidates = mongoTemplate.find(candidateQuery, Room.class);

        // ── 3. Batch fetch hotels (only APPROVED) ─────────────────────────

        Set<String> hotelIds = candidates.stream()
                .map(Room::getHotelId).collect(Collectors.toSet());
        Map<String, Hotel> hotelMap = hotelRepository.findAllById(hotelIds).stream()
                .filter(h -> HotelStatus.APPROVED.equals(h.getStatus()))
                .collect(Collectors.toMap(Hotel::getId, h -> h));

        // ── 4. Score, sort, limit ─────────────────────────────────────────

        final long totalTypedFinal = totalTyped > 0 ? totalTyped : 1;
        final double avgPrice      = avgPricePerNight > 0 ? avgPricePerNight : 1.0;

        return candidates.stream()
                .filter(r -> hotelMap.containsKey(r.getHotelId()))
                .map(room -> {
                    Hotel hotel = hotelMap.get(room.getHotelId());

                    double typeScore = (double) typeFrequency
                            .getOrDefault(room.getType(), 0L) / totalTypedFinal;

                    double priceSim = Math.max(0.0,
                            1.0 - Math.abs(room.getPricePerNight() - avgPrice) / avgPrice);

                    double ratingScore = (hotel.getAvgRating() != null ? hotel.getAvgRating() : 0.0) / 5.0;

                    double score = W_TYPE * typeScore + W_PRICE * priceSim + W_RATING * ratingScore;

                    return buildResponse(room, hotel, score);
                })
                .sorted(Comparator.comparingDouble(RoomRecommendationResponse::getScore).reversed())
                .limit(size)
                .collect(Collectors.toList());
    }

    // ════════════════════════════════════════════════════════════════════════
    // Collaborative Filtering  —  Jaccard similarity
    // ════════════════════════════════════════════════════════════════════════

    private static final int CF_TOP_K = 20; // số neighbor lấy

    @Cacheable(value = "rec:cf", key = "#userEmail")
    public List<RoomRecommendationResponse> getCollaborativeRecommendations(
            String userEmail, int size) {

        String userId = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND)).getId();

        // ── 1. Lịch sử phòng của user hiện tại ───────────────────────────
        List<Booking> myBookings = bookingRepository
                .findByUserIdAndStatusIn(userId, HISTORY_STATUSES);
        if (myBookings.isEmpty()) return Collections.emptyList();

        Set<String> myRoomIds = myBookings.stream()
                .map(Booking::getRoomId).collect(Collectors.toSet());

        // ── 2. Bookings của user khác có ít nhất 1 phòng trùng ────────────
        List<Booking> neighborBookings = bookingRepository
                .findByRoomIdInAndUserIdNotAndStatusIn(myRoomIds, userId, HISTORY_STATUSES);
        if (neighborBookings.isEmpty()) return Collections.emptyList();

        // ── 3. Gom nhóm: neighborId → Set<roomId> họ đã đặt ─────────────
        Map<String, Set<String>> neighborRoomSets = neighborBookings.stream()
                .collect(Collectors.groupingBy(
                        Booking::getUserId,
                        Collectors.mapping(Booking::getRoomId, Collectors.toSet())
                ));

        // ── 4. Jaccard similarity  =  |A ∩ B| / |A ∪ B| ─────────────────
        Map<String, Double> jaccardScores = new HashMap<>();
        for (Map.Entry<String, Set<String>> entry : neighborRoomSets.entrySet()) {
            Set<String> neighborRooms = entry.getValue();
            long intersectionSize = myRoomIds.stream().filter(neighborRooms::contains).count();
            long unionSize = myRoomIds.size() + neighborRooms.size() - intersectionSize;
            if (intersectionSize > 0 && unionSize > 0) {
                jaccardScores.put(entry.getKey(), (double) intersectionSize / unionSize);
            }
        }
        if (jaccardScores.isEmpty()) return Collections.emptyList();

        // ── 5. Top-K neighbor theo Jaccard ───────────────────────────────
        List<Map.Entry<String, Double>> topNeighbors = jaccardScores.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(CF_TOP_K)
                .collect(Collectors.toList());

        // ── 6. Gom điểm phòng: roomScore += jaccard với mỗi neighbor ─────
        //    Chỉ lấy phòng user chưa đặt
        Map<String, Double> roomScoreMap = new HashMap<>();
        for (Map.Entry<String, Double> neighbor : topNeighbors) {
            double sim = neighbor.getValue();
            for (String roomId : neighborRoomSets.get(neighbor.getKey())) {
                if (!myRoomIds.contains(roomId)) {
                    roomScoreMap.merge(roomId, sim, Double::sum);
                }
            }
        }
        if (roomScoreMap.isEmpty()) return Collections.emptyList();

        // ── 7. Fetch rooms (AVAILABLE) & hotels (APPROVED) ───────────────
        Map<String, Room> roomMap = roomRepository
                .findAllById(roomScoreMap.keySet()).stream()
                .filter(r -> RoomStatus.AVAILABLE.equals(r.getStatus()))
                .collect(Collectors.toMap(Room::getId, r -> r));

        Set<String> hotelIds = roomMap.values().stream()
                .map(Room::getHotelId).collect(Collectors.toSet());
        Map<String, Hotel> hotelMap = hotelRepository.findAllById(hotelIds).stream()
                .filter(h -> HotelStatus.APPROVED.equals(h.getStatus()))
                .collect(Collectors.toMap(Hotel::getId, h -> h));

        // ── 8. Normalize scores, sort desc, limit ────────────────────────
        double maxScore = roomScoreMap.values().stream()
                .mapToDouble(Double::doubleValue).max().orElse(1.0);

        return roomScoreMap.entrySet().stream()
                .filter(e -> roomMap.containsKey(e.getKey()))
                .filter(e -> hotelMap.containsKey(roomMap.get(e.getKey()).getHotelId()))
                .map(e -> {
                    Room  room  = roomMap.get(e.getKey());
                    Hotel hotel = hotelMap.get(room.getHotelId());
                    return buildResponse(room, hotel, e.getValue() / maxScore);
                })
                .sorted(Comparator.comparingDouble(RoomRecommendationResponse::getScore).reversed())
                .limit(size)
                .collect(Collectors.toList());
    }

    // ════════════════════════════════════════════════════════════════════════
    // Hybrid  —  CBF + CF, single DB pass
    // ════════════════════════════════════════════════════════════════════════

    @Cacheable(value = "rec:hybrid", key = "#userEmail")
    public List<RoomRecommendationResponse> getHybridRecommendations(String userEmail, int size) {
        String userId = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND)).getId();

        List<Booking> history = bookingRepository
                .findByUserIdAndStatusIn(userId, HISTORY_STATUSES);
        if (history.isEmpty()) return coldStart(size);

        Set<String> myRoomIds = history.stream()
                .map(Booking::getRoomId).collect(Collectors.toSet());

        // ── CBF: build preference profile ────────────────────────────────
        Map<String, Room> historicRoomMap = roomRepository.findAllById(myRoomIds).stream()
                .collect(Collectors.toMap(Room::getId, r -> r));

        Map<RoomType, Long> typeFreq = history.stream()
                .map(b -> historicRoomMap.get(b.getRoomId()))
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Room::getType, Collectors.counting()));
        final long totalTyped = Math.max(
                typeFreq.values().stream().mapToLong(Long::longValue).sum(), 1L);

        final double avgPrice = Math.max(
                history.stream()
                        .filter(b -> b.getTotalPrice() != null
                                && b.getCheckIn() != null && b.getCheckOut() != null)
                        .mapToDouble(b -> {
                            long nights = ChronoUnit.DAYS.between(b.getCheckIn(), b.getCheckOut());
                            return nights > 0 ? b.getTotalPrice() / nights : b.getTotalPrice();
                        })
                        .average().orElse(500_000.0),
                1.0);

        // ── CF: Jaccard neighbor scores per room ─────────────────────────
        Map<String, Double> cfRawScores = new HashMap<>();
        List<Booking> neighborBookings = bookingRepository
                .findByRoomIdInAndUserIdNotAndStatusIn(myRoomIds, userId, HISTORY_STATUSES);

        if (!neighborBookings.isEmpty()) {
            Map<String, Set<String>> neighborRoomSets = neighborBookings.stream()
                    .collect(Collectors.groupingBy(Booking::getUserId,
                            Collectors.mapping(Booking::getRoomId, Collectors.toSet())));

            // Jaccard per neighbor → top-K
            neighborRoomSets.entrySet().stream()
                    .map(e -> {
                        Set<String> nr = e.getValue();
                        long inter = myRoomIds.stream().filter(nr::contains).count();
                        long union = myRoomIds.size() + nr.size() - inter;
                        double jaccard = (inter > 0 && union > 0)
                                ? (double) inter / union : 0.0;
                        return Map.entry(e.getKey(), jaccard);
                    })
                    .filter(e -> e.getValue() > 0)
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .limit(CF_TOP_K)
                    .forEach(e -> {
                        for (String roomId : neighborRoomSets.get(e.getKey())) {
                            if (!myRoomIds.contains(roomId)) {
                                cfRawScores.merge(roomId, e.getValue(), Double::sum);
                            }
                        }
                    });
        }
        final double cfMax = cfRawScores.values().stream()
                .mapToDouble(Double::doubleValue).max().orElse(1.0);

        // ── Single fetch: ALL AVAILABLE rooms ────────────────────────────
        // Không loại trừ myRoomIds — user có thể muốn đặt lại cùng loại phòng.
        // CF score = 0 cho phòng đã đặt (xử lý riêng bên trên), CBF vẫn score bình thường.
        List<Room> candidates = mongoTemplate.find(
                Query.query(Criteria.where("status").is(RoomStatus.AVAILABLE.name())),
                Room.class);

        Set<String> hotelIds = candidates.stream()
                .map(Room::getHotelId).collect(Collectors.toSet());
        Map<String, Hotel> hotelMap = hotelRepository.findAllById(hotelIds).stream()
                .filter(h -> HotelStatus.APPROVED.equals(h.getStatus()))
                .collect(Collectors.toMap(Hotel::getId, h -> h));

        // ── CBF raw scores per candidate ──────────────────────────────────
        Map<String, Double> cbfRawScores = new HashMap<>();
        for (Room room : candidates) {
            if (!hotelMap.containsKey(room.getHotelId())) continue;
            Hotel hotel = hotelMap.get(room.getHotelId());
            double typeScore   = (double) typeFreq.getOrDefault(room.getType(), 0L) / totalTyped;
            double priceSim    = Math.max(0.0,
                    1.0 - Math.abs(room.getPricePerNight() - avgPrice) / avgPrice);
            double ratingScore = (hotel.getAvgRating() != null ? hotel.getAvgRating() : 0.0) / 5.0;
            cbfRawScores.put(room.getId(),
                    W_TYPE * typeScore + W_PRICE * priceSim + W_RATING * ratingScore);
        }
        final double cbfMax = cbfRawScores.values().stream()
                .mapToDouble(Double::doubleValue).max().orElse(1.0);

        // ── Hybrid merge, sort, limit ─────────────────────────────────────
        return candidates.stream()
                .filter(r -> cbfRawScores.containsKey(r.getId()))
                .map(room -> {
                    Hotel hotel   = hotelMap.get(room.getHotelId());
                    double cbfN   = cbfRawScores.get(room.getId()) / cbfMax;
                    double cfN    = cfRawScores.getOrDefault(room.getId(), 0.0) / cfMax;
                    double hybrid = W_HYBRID_CBF * cbfN + W_HYBRID_CF * cfN;
                    return buildResponse(room, hotel, hybrid);
                })
                .sorted(Comparator.comparingDouble(RoomRecommendationResponse::getScore).reversed())
                .limit(size)
                .collect(Collectors.toList());
    }

    // ── Cold start: no booking history → top-rated available rooms ────────

    private List<RoomRecommendationResponse> coldStart(int size) {
        List<Room> available = mongoTemplate.find(
                Query.query(Criteria.where("status").is(RoomStatus.AVAILABLE.name())),
                Room.class
        );

        Set<String> hotelIds = available.stream()
                .map(Room::getHotelId).collect(Collectors.toSet());
        Map<String, Hotel> hotelMap = hotelRepository.findAllById(hotelIds).stream()
                .filter(h -> HotelStatus.APPROVED.equals(h.getStatus()))
                .collect(Collectors.toMap(Hotel::getId, h -> h));

        return available.stream()
                .filter(r -> hotelMap.containsKey(r.getHotelId()))
                .sorted(Comparator.comparingDouble(
                        r -> -(hotelMap.get(r.getHotelId()).getAvgRating() != null
                                ? hotelMap.get(r.getHotelId()).getAvgRating() : 0.0)))
                .limit(size)
                .map(room -> {
                    Hotel hotel = hotelMap.get(room.getHotelId());
                    double score = (hotel.getAvgRating() != null ? hotel.getAvgRating() : 0.0) / 5.0;
                    return buildResponse(room, hotel, score);
                })
                .collect(Collectors.toList());
    }

    // ── Builder helper ────────────────────────────────────────────────────

    private RoomRecommendationResponse buildResponse(Room room, Hotel hotel, double score) {
        String hotelImage = (hotel.getImages() != null && !hotel.getImages().isEmpty())
                ? hotel.getImages().get(0) : null;
        return RoomRecommendationResponse.builder()
                .roomId(room.getId())
                .hotelId(hotel.getId())
                .hotelName(hotel.getName())
                .hotelCity(hotel.getCity())
                .hotelAvgRating(hotel.getAvgRating())
                .hotelImage(hotelImage)
                .roomNumber(room.getRoomNumber())
                .type(room.getType().name())
                .pricePerNight(room.getPricePerNight())
                .capacity(room.getCapacity())
                .amenities(room.getAmenities())
                .images(room.getImages())
                .score(Math.round(score * 1000.0) / 1000.0)
                .build();
    }
}
