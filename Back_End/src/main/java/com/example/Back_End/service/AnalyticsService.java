package com.example.Back_End.service;

import com.example.Back_End.dto.response.*;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Discount;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.PaymentStatus;
import com.example.Back_End.repository.DiscountRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.data.mongodb.core.aggregation.Fields;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final HotelRepository    hotelRepository;
    private final RoomRepository     roomRepository;
    private final DiscountRepository discountRepository;
    private final UserRepository     userRepository;
    private final MongoTemplate      mongoTemplate;

    // ── Xác thực quyền sở hữu ─────────────────────────────────────────────

    private Hotel getHotelForOwner(String ownerEmail, String hotelId) {
        String ownerId = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND)).getId();
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));
        if (!hotel.getOwnerId().equals(ownerId))
            throw new AppException(ErrorCode.HOTEL_NOT_OWNED);
        return hotel;
    }

    // ── 1. Tổng quan (current month + all-time) ───────────────────────────

    @Cacheable(value = "analytics:overview", key = "#hotelId")
    public OverviewResponse getOverview(String ownerEmail, String hotelId) {
        Hotel hotel = getHotelForOwner(ownerEmail, hotelId);

        // Tổng booking mọi thời điểm
        long totalBookings = mongoTemplate.count(
                Query.query(Criteria.where("hotelId").is(hotelId)), Booking.class);

        // Doanh thu tháng hiện tại (PAID)
        LocalDateTime startOfMonth = YearMonth.now().atDay(1).atStartOfDay();
        LocalDateTime endOfMonth   = YearMonth.now().atEndOfMonth().atTime(23, 59, 59);

        Aggregation revenueAgg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("hotelId").is(hotelId)
                        .and("paymentStatus").is(PaymentStatus.PAID.name())
                        .and("createdAt").gte(startOfMonth).lte(endOfMonth)),
                Aggregation.group().sum("totalPrice").as("total")
        );
        Document revenueDoc = mongoTemplate
                .aggregate(revenueAgg, "bookings", Document.class)
                .getUniqueMappedResult();
        double revenueThisMonth = revenueDoc != null
                ? ((Number) revenueDoc.get("total")).doubleValue() : 0.0;

        // Tỷ lệ lấp đầy hôm nay = CHECKED_IN / tổng phòng
        int totalRooms = roomRepository.findByHotelId(hotelId).size();
        long checkedIn = mongoTemplate.count(
                Query.query(Criteria.where("hotelId").is(hotelId)
                        .and("status").is(BookingStatus.CHECKED_IN.name())), Booking.class);
        double occupancyRate = totalRooms > 0
                ? Math.round((double) checkedIn / totalRooms * 1000.0) / 10.0 : 0.0;

        return OverviewResponse.builder()
                .totalBookings(totalBookings)
                .revenueThisMonth(revenueThisMonth)
                .occupancyRate(occupancyRate)
                .avgRating(hotel.getAvgRating())
                .reviewCount(hotel.getReviewCount())
                .totalRooms(totalRooms)
                .build();
    }

    // ── 2. Biểu đồ doanh thu (time-series) ───────────────────────────────

    @Cacheable(value = "analytics:revenue", key = "#hotelId + ':' + #period + ':' + #from + ':' + #to")
    public List<RevenueDataPoint> getRevenue(String ownerEmail, String hotelId,
                                             String period, LocalDate from, LocalDate to) {
        getHotelForOwner(ownerEmail, hotelId);

        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt   = to.atTime(23, 59, 59);

        boolean weekly = "weekly".equalsIgnoreCase(period);

        // Project năm + tháng/tuần, rồi group
        Aggregation agg;
        if (weekly) {
            agg = Aggregation.newAggregation(
                    Aggregation.match(Criteria.where("hotelId").is(hotelId)
                            .and("paymentStatus").is(PaymentStatus.PAID.name())
                            .and("createdAt").gte(fromDt).lte(toDt)),
                    Aggregation.project()
                            .and(DateOperators.Year.yearOf("createdAt")).as("year")
                            .and(DateOperators.Week.weekOf("createdAt")).as("week")
                            .and("totalPrice").as("totalPrice"),
                    Aggregation.group(Fields.from(Fields.field("year"), Fields.field("week")))
                            .sum("totalPrice").as("revenue")
                            .count().as("bookingCount"),
                    Aggregation.sort(Sort.by("_id.year", "_id.week"))
            );
        } else {
            agg = Aggregation.newAggregation(
                    Aggregation.match(Criteria.where("hotelId").is(hotelId)
                            .and("paymentStatus").is(PaymentStatus.PAID.name())
                            .and("createdAt").gte(fromDt).lte(toDt)),
                    Aggregation.project()
                            .and(DateOperators.Year.yearOf("createdAt")).as("year")
                            .and(DateOperators.Month.monthOf("createdAt")).as("month")
                            .and("totalPrice").as("totalPrice"),
                    Aggregation.group(Fields.from(Fields.field("year"), Fields.field("month")))
                            .sum("totalPrice").as("revenue")
                            .count().as("bookingCount"),
                    Aggregation.sort(Sort.by("_id.year", "_id.month"))
            );
        }

        AggregationResults<Document> results = mongoTemplate.aggregate(agg, "bookings", Document.class);

        return results.getMappedResults().stream().map(doc -> {
            Document id   = (Document) doc.get("_id");
            int year      = id.getInteger("year");
            String periodStr = weekly
                    ? String.format("%d-W%02d", year, id.getInteger("week"))
                    : String.format("%d-%02d",  year, id.getInteger("month"));
            return RevenueDataPoint.builder()
                    .period(periodStr)
                    .revenue(((Number) doc.get("revenue")).doubleValue())
                    .bookingCount(((Number) doc.get("bookingCount")).longValue())
                    .build();
        }).collect(Collectors.toList());
    }

    // ── 3. Booking theo trạng thái (pie chart) ───────────────────────────

    @Cacheable(value = "analytics:booking-status", key = "#hotelId + ':' + #from + ':' + #to")
    public List<BookingStatusStat> getBookingsByStatus(String ownerEmail, String hotelId,
                                                       LocalDate from, LocalDate to) {
        getHotelForOwner(ownerEmail, hotelId);

        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt   = to.atTime(23, 59, 59);

        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("hotelId").is(hotelId)
                        .and("createdAt").gte(fromDt).lte(toDt)),
                Aggregation.group("status").count().as("count"),
                Aggregation.sort(Sort.by(Sort.Direction.DESC, "count"))
        );

        return mongoTemplate.aggregate(agg, "bookings", Document.class)
                .getMappedResults().stream()
                .map(doc -> BookingStatusStat.builder()
                        .status(doc.getString("_id"))
                        .count(((Number) doc.get("count")).longValue())
                        .build())
                .collect(Collectors.toList());
    }

    // ── 4. Top 5 phòng phổ biến ──────────────────────────────────────────

    @Cacheable(value = "analytics:top-rooms", key = "#hotelId + ':' + #from + ':' + #to")
    public List<TopRoomStat> getTopRooms(String ownerEmail, String hotelId,
                                         LocalDate from, LocalDate to) {
        getHotelForOwner(ownerEmail, hotelId);

        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt   = to.atTime(23, 59, 59);

        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("hotelId").is(hotelId)
                        .and("createdAt").gte(fromDt).lte(toDt)
                        .and("status").nin(
                                BookingStatus.CANCELLED.name(), BookingStatus.REJECTED.name())),
                Aggregation.group("roomId")
                        .count().as("bookingCount")
                        .sum("totalPrice").as("totalRevenue"),
                Aggregation.sort(Sort.by(Sort.Direction.DESC, "bookingCount")),
                Aggregation.limit(5)
        );

        List<Document> docs = mongoTemplate
                .aggregate(agg, "bookings", Document.class).getMappedResults();

        // Batch fetch room info — 1 query
        List<String> roomIds = docs.stream().map(d -> d.getString("_id")).collect(Collectors.toList());
        Map<String, Room> roomMap = roomRepository.findAllById(roomIds).stream()
                .collect(Collectors.toMap(Room::getId, r -> r));

        return docs.stream().map(doc -> {
            String roomId = doc.getString("_id");
            Room   room   = roomMap.get(roomId);
            return TopRoomStat.builder()
                    .roomId(roomId)
                    .roomNumber(room != null ? room.getRoomNumber() : "—")
                    .roomType(room != null ? room.getType().name()  : "—")
                    .bookingCount(((Number) doc.get("bookingCount")).longValue())
                    .totalRevenue(((Number) doc.get("totalRevenue")).doubleValue())
                    .build();
        }).collect(Collectors.toList());
    }

    // ── 5. Thống kê discount ─────────────────────────────────────────────

    @Cacheable(value = "analytics:discounts", key = "#hotelId + ':' + #from + ':' + #to")
    public List<DiscountStat> getDiscountStats(String ownerEmail, String hotelId,
                                               LocalDate from, LocalDate to) {
        getHotelForOwner(ownerEmail, hotelId);

        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt   = to.atTime(23, 59, 59);

        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("hotelId").is(hotelId)
                        .and("discountId").ne(null)
                        .and("createdAt").gte(fromDt).lte(toDt)),
                Aggregation.group("discountId")
                        .count().as("usageCount")
                        .sum("discountAmount").as("totalDiscountAmount"),
                Aggregation.sort(Sort.by(Sort.Direction.DESC, "usageCount"))
        );

        List<Document> docs = mongoTemplate
                .aggregate(agg, "bookings", Document.class).getMappedResults();

        // Batch fetch discount info — 1 query
        List<String> discountIds = docs.stream().map(d -> d.getString("_id")).collect(Collectors.toList());
        Map<String, Discount> discountMap = discountRepository.findAllById(discountIds).stream()
                .collect(Collectors.toMap(Discount::getId, d -> d));

        return docs.stream().map(doc -> {
            String   discountId = doc.getString("_id");
            Discount discount   = discountMap.get(discountId);
            return DiscountStat.builder()
                    .discountId(discountId)
                    .code(discount != null ? discount.getCode() : "—")
                    .name(discount != null ? discount.getName() : "—")
                    .usageCount(((Number) doc.get("usageCount")).longValue())
                    .totalDiscountAmount(((Number) doc.get("totalDiscountAmount")).doubleValue())
                    .build();
        }).collect(Collectors.toList());
    }

    // ── 6. Gợi ý điều chỉnh giá (occupancy tuần này vs 4 tuần trước) ────

    @Cacheable(value = "analytics:price", key = "#hotelId")
    public PriceSuggestionResponse getPriceSuggestion(String ownerEmail, String hotelId) {
        getHotelForOwner(ownerEmail, hotelId);

        int totalRooms = roomRepository.findByHotelId(hotelId).size();
        LocalDate today = LocalDate.now();

        String[] labels = {
                "Tuần này", "1 tuần trước", "2 tuần trước", "3 tuần trước", "4 tuần trước"
        };

        List<Double> occupancies = new ArrayList<>();
        List<PriceSuggestionResponse.WeekOccupancy> breakdown = new ArrayList<>();

        for (int i = 0; i < 5; i++) {
            LocalDate end   = today.minusWeeks(i);
            LocalDate start = end.minusDays(6);
            double occ = calcWeeklyOccupancy(hotelId, start, end, totalRooms);
            occupancies.add(occ);
            breakdown.add(PriceSuggestionResponse.WeekOccupancy.builder()
                    .label(labels[i])
                    .occupancy(round1(occ))
                    .build());
        }

        double thisWeek = occupancies.get(0);
        double avgPast4 = occupancies.subList(1, 5).stream()
                .mapToDouble(Double::doubleValue).average().orElse(0.0);
        double delta = thisWeek - avgPast4;

        // ── Ngưỡng đề xuất ───────────────────────────────────────────────
        String action;
        int    pct;
        String reason;

        if (delta > 15) {
            action = "INCREASE"; pct = 10;
            reason = String.format("Lấp đầy cao hơn %.1f%% so với trung bình 4 tuần — nhu cầu rất mạnh.", delta);
        } else if (delta > 8) {
            action = "INCREASE"; pct = 7;
            reason = String.format("Lấp đầy tăng %.1f%% — xu hướng tốt, có thể tối ưu doanh thu.", delta);
        } else if (delta > 3) {
            action = "INCREASE"; pct = 5;
            reason = String.format("Lấp đầy nhỉnh hơn %.1f%% — tăng giá nhẹ để thăm dò thị trường.", delta);
        } else if (delta >= -3) {
            action = "KEEP"; pct = 0;
            reason = "Lấp đầy ổn định so với 4 tuần qua — không cần điều chỉnh giá.";
        } else if (delta >= -8) {
            action = "DECREASE"; pct = 5;
            reason = String.format("Lấp đầy giảm %.1f%% — giảm giá nhẹ để thu hút thêm đặt phòng.", Math.abs(delta));
        } else if (delta >= -15) {
            action = "DECREASE"; pct = 7;
            reason = String.format("Lấp đầy thấp hơn đáng kể %.1f%% — cần kích cầu bằng giá.", Math.abs(delta));
        } else {
            action = "DECREASE"; pct = 10;
            reason = String.format("Lấp đầy rất thấp, giảm %.1f%% — điều chỉnh giá để cải thiện công suất.", Math.abs(delta));
        }

        return PriceSuggestionResponse.builder()
                .thisWeekOccupancy(round1(thisWeek))
                .avgPast4WeeksOccupancy(round1(avgPast4))
                .occupancyDelta(round1(delta))
                .action(action)
                .suggestedAdjustmentPct(pct)
                .reason(reason)
                .weeklyBreakdown(breakdown)
                .build();
    }

    private double calcWeeklyOccupancy(String hotelId, LocalDate start, LocalDate end, int totalRooms) {
        if (totalRooms == 0) return 0.0;

        // Đếm số phòng distinct có booking overlap [start, end]
        // Overlap: checkIn <= end AND checkOut > start
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(
                        Criteria.where("hotelId").is(hotelId)
                                .and("status").nin(
                                        BookingStatus.CANCELLED.name(),
                                        BookingStatus.REJECTED.name())
                                .and("checkIn").lte(end)
                                .and("checkOut").gt(start)
                ),
                Aggregation.group("roomId")
        );

        long distinctRooms = mongoTemplate
                .aggregate(agg, "bookings", Document.class)
                .getMappedResults().size();

        return (double) distinctRooms / totalRooms * 100.0;
    }

    // ── 7. Dự báo booking (Moving Average 4 tuần) ───────────────────────

    @Cacheable(value = "analytics:forecast", key = "#hotelId")
    public BookingForecastResponse getForecast(String ownerEmail, String hotelId) {
        getHotelForOwner(ownerEmail, hotelId);

        LocalDate today = LocalDate.now();

        // ── Đếm booking cho 5 khoảng (4 tuần hoàn chỉnh + tuần này) ─────
        // i = 1..4: tuần hoàn chỉnh, i = 0: tuần hiện tại
        long[] counts  = new long[5];
        String[] ranges = new String[5];

        for (int i = 4; i >= 0; i--) {
            LocalDate end   = today.minusWeeks(i);
            LocalDate start = end.minusDays(6);
            counts[i]  = countBookingsInWeek(hotelId, start, end);
            ranges[i]  = fmtRange(start, end);
        }
        // counts[0] = tuần này, counts[1] = 1 tuần trước, …, counts[4] = 4 tuần trước

        // ── Moving Average: trung bình 4 tuần HOÀN CHỈNH (index 1..4) ───
        double ma = (counts[1] + counts[2] + counts[3] + counts[4]) / 4.0;
        long forecast = Math.round(ma);

        // ── Trend: so với tuần gần nhất (index 1) ────────────────────────
        long   lastWeek = counts[1];
        double trendPct = lastWeek > 0
                ? (ma - lastWeek) / lastWeek * 100.0
                : (ma > 0 ? 100.0 : 0.0);
        String trend = trendPct > 5 ? "UP" : trendPct < -5 ? "DOWN" : "STABLE";

        // ── Build history list: oldest first (index 4 → 1) ───────────────
        String[] histLabels = {"4 tuần trước", "3 tuần trước", "2 tuần trước", "1 tuần trước"};
        List<BookingForecastResponse.WeekStat> history = new ArrayList<>();
        for (int i = 4; i >= 1; i--) {
            history.add(BookingForecastResponse.WeekStat.builder()
                    .label(histLabels[4 - i])
                    .dateRange(ranges[i])
                    .count(counts[i])
                    .build());
        }

        BookingForecastResponse.WeekStat thisWeekStat = BookingForecastResponse.WeekStat.builder()
                .label("Tuần này")
                .dateRange(ranges[0])
                .count(counts[0])
                .build();

        // ── Forecast week ─────────────────────────────────────────────────
        LocalDate fStart = today.plusDays(1);
        LocalDate fEnd   = today.plusDays(7);

        return BookingForecastResponse.builder()
                .history(history)
                .thisWeek(thisWeekStat)
                .forecastCount(forecast)
                .movingAverage(round1(ma))
                .forecastWeek(fmtRange(fStart, fEnd))
                .trend(trend)
                .trendPct(round1(trendPct))
                .build();
    }

    private long countBookingsInWeek(String hotelId, LocalDate start, LocalDate end) {
        LocalDateTime from = start.atStartOfDay();
        LocalDateTime to   = end.atTime(23, 59, 59);
        return mongoTemplate.count(
                Query.query(
                        Criteria.where("hotelId").is(hotelId)
                                .and("status").nin(BookingStatus.REJECTED.name())
                                .and("createdAt").gte(from).lte(to)
                ),
                Booking.class
        );
    }

    private static final DateTimeFormatter RANGE_FMT = DateTimeFormatter.ofPattern("dd/MM");

    private static String fmtRange(LocalDate start, LocalDate end) {
        return start.format(RANGE_FMT) + " – " + end.format(RANGE_FMT);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
