package com.example.Back_End.service;

import com.example.Back_End.dto.response.NearbyHotelResponse;
import com.example.Back_End.model.GeoLocation;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.enums.HotelStatus;
import com.example.Back_End.repository.HotelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.GeospatialIndex;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Integration test: Nearby hotel geo search — $nearSphere via NearQuery.
 *
 * Chiến lược:
 *  - @DataMongoTest  → HotelRepository + MongoTemplate thật
 *  - @Import(HotelService.class) → service khởi tạo với repo thật
 *  - @MockitoBean GeocodingService → không gọi HTTP geocoding ra ngoài
 *
 * Tọa độ tham chiếu (tâm tìm kiếm):
 *   Hồ Hoàn Kiếm, Hà Nội — lat=21.0285, lng=105.8542
 *
 * Hệ số tại vĩ độ 21°N:
 *   1° lat ≈ 111.32 km
 *   Offset Δlat để đặt hotel cách tâm d km về phía Bắc: Δlat = d / 111.32
 *
 * Tất cả hotel test được đặt thẳng phía Bắc tâm (cùng lng) để khoảng cách
 * thực tế xấp xỉ đúng Δlat × 111.32 km — sai số < 0.1 km trong vòng 15 km.
 *
 * MongoDB index: GEO_2DSPHERE trên Hotel.location — bắt buộc cho $nearSphere.
 * Được tạo bằng auto-index-creation=true + ensureIndex() trong @BeforeEach.
 */
@DataMongoTest
@Import(HotelService.class)
@TestPropertySource(properties = "spring.data.mongodb.auto-index-creation=true")
@DisplayName("Integration: Nearby hotel geo search ($nearSphere / NearQuery)")
class NearbyHotelSearchIntegrationTest {

    // ── real beans ───────────────────────────────────────────────────────────

    @Autowired HotelService    hotelService;
    @Autowired HotelRepository hotelRepository;
    @Autowired MongoTemplate   mongoTemplate;

    // ── mock ─────────────────────────────────────────────────────────────────

    @MockitoBean GeocodingService geocodingService;

    // ── constants ─────────────────────────────────────────────────────────────

    /** Tâm tìm kiếm: Hồ Hoàn Kiếm, Hà Nội */
    static final double CTR_LAT = 21.0285;
    static final double CTR_LNG = 105.8542;

    /** km → Δlat degrees (moving north) */
    private static double latOffset(double km) {
        return km / 111.32;
    }

    // ── setup ─────────────────────────────────────────────────────────────────

    @BeforeEach
    void setUp() {
        // Đảm bảo 2dsphere index tồn tại — bắt buộc cho NearQuery.spherical(true)
        mongoTemplate.indexOps(Hotel.class).createIndex(
                new GeospatialIndex("location").typed(GeoSpatialIndexType.GEO_2DSPHERE));
        hotelRepository.deleteAll();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Hotel saveApproved(String name, double lat, double lng) {
        return save(name, lat, lng, HotelStatus.APPROVED);
    }

    private Hotel save(String name, double lat, double lng, HotelStatus status) {
        // GeoLocation.of([lng, lat]) — thứ tự GeoJSON: longitude trước, latitude sau
        return hotelRepository.save(Hotel.builder()
                .name(name).city("Hà Nội").ownerId("owner-001")
                .status(status)
                .location(GeoLocation.of(lng, lat))
                .build());
    }

    // ════════════════════════════════════════════════════════════════════════
    //  1. Lọc theo bán kính
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Lọc bán kính ($nearSphere maxDistance)")
    class RadiusFiltering {

        @Test
        @DisplayName("10km radius — 0.5km, 3km, 7km trong; 12km ngoài")
        void radius10km_includesNearby_excludesFar() {
            saveApproved("Hotel-0.5km",  CTR_LAT + latOffset(0.5),  CTR_LNG);
            saveApproved("Hotel-3km",    CTR_LAT + latOffset(3.0),  CTR_LNG);
            saveApproved("Hotel-7km",    CTR_LAT + latOffset(7.0),  CTR_LNG);
            saveApproved("Hotel-12km",   CTR_LAT + latOffset(12.0), CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 20);
            List<String> names = result.stream().map(NearbyHotelResponse::getName).toList();

            assertThat(names).contains("Hotel-0.5km", "Hotel-3km", "Hotel-7km");
            assertThat(names).doesNotContain("Hotel-12km");
        }

        @Test
        @DisplayName("5km radius — 0.5km, 3km trong; 7km, 12km ngoài")
        void radius5km_includesNearby_excludesFar() {
            saveApproved("Hotel-0.5km",  CTR_LAT + latOffset(0.5),  CTR_LNG);
            saveApproved("Hotel-3km",    CTR_LAT + latOffset(3.0),  CTR_LNG);
            saveApproved("Hotel-7km",    CTR_LAT + latOffset(7.0),  CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 5.0, 20);
            List<String> names = result.stream().map(NearbyHotelResponse::getName).toList();

            assertThat(names).contains("Hotel-0.5km", "Hotel-3km");
            assertThat(names).doesNotContain("Hotel-7km");
        }

        @Test
        @DisplayName("1km radius — 0.5km trong; 2km ngoài")
        void radius1km_onlyVeryCloseReturned() {
            saveApproved("Hotel-0.5km",  CTR_LAT + latOffset(0.5),  CTR_LNG);
            saveApproved("Hotel-2km",    CTR_LAT + latOffset(2.0),  CTR_LNG);
            saveApproved("Hotel-5km",    CTR_LAT + latOffset(5.0),  CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 1.0, 20);
            List<String> names = result.stream().map(NearbyHotelResponse::getName).toList();

            assertThat(names).containsOnly("Hotel-0.5km");
        }

        @Test
        @DisplayName("Không có hotel trong bán kính → danh sách rỗng")
        void noHotelsInRadius_returnsEmpty() {
            saveApproved("Hotel-Far", CTR_LAT + latOffset(20.0), CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 5.0, 20);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("DB rỗng → danh sách rỗng")
        void emptyDatabase_returnsEmpty() {
            assertThat(hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 20)).isEmpty();
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  2. Sắp xếp theo khoảng cách
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Sắp xếp theo khoảng cách (gần nhất trước)")
    class DistanceSorting {

        @Test
        @DisplayName("Kết quả theo thứ tự: 0.5km < 3km < 7km")
        void resultsSortedNearestFirst() {
            // Seed ngược thứ tự để đảm bảo DB order không ảnh hưởng
            saveApproved("Hotel-7km",   CTR_LAT + latOffset(7.0),  CTR_LNG);
            saveApproved("Hotel-0.5km", CTR_LAT + latOffset(0.5),  CTR_LNG);
            saveApproved("Hotel-3km",   CTR_LAT + latOffset(3.0),  CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 20);

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getName()).isEqualTo("Hotel-0.5km");
            assertThat(result.get(1).getName()).isEqualTo("Hotel-3km");
            assertThat(result.get(2).getName()).isEqualTo("Hotel-7km");
        }

        @Test
        @DisplayName("distanceKm tăng dần trong kết quả")
        void distanceKmMonotonicallyIncreasing() {
            saveApproved("A", CTR_LAT + latOffset(1.0), CTR_LNG);
            saveApproved("B", CTR_LAT + latOffset(4.0), CTR_LNG);
            saveApproved("C", CTR_LAT + latOffset(8.0), CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 20);

            assertThat(result).hasSize(3);
            for (int i = 0; i < result.size() - 1; i++) {
                assertThat(result.get(i).getDistanceKm())
                        .isLessThan(result.get(i + 1).getDistanceKm());
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  3. Giá trị distanceKm
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Giá trị distanceKm (độ chính xác ±0.3km)")
    class DistanceAccuracy {

        @Test
        @DisplayName("Hotel cách 3km — distanceKm xấp xỉ 3.0 ±0.3")
        void distance3km_approximatelyCorrect() {
            saveApproved("Hotel-3km", CTR_LAT + latOffset(3.0), CTR_LNG);

            NearbyHotelResponse res = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 5.0, 1).get(0);

            assertThat(res.getDistanceKm()).isCloseTo(3.0, within(0.3));
        }

        @Test
        @DisplayName("Hotel cách 7km — distanceKm xấp xỉ 7.0 ±0.3")
        void distance7km_approximatelyCorrect() {
            saveApproved("Hotel-7km", CTR_LAT + latOffset(7.0), CTR_LNG);

            NearbyHotelResponse res = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 1).get(0);

            assertThat(res.getDistanceKm()).isCloseTo(7.0, within(0.3));
        }

        @Test
        @DisplayName("Hotel tại vị trí tâm (0m) — distanceKm ≈ 0")
        void distanceZero_hotelAtSearchCenter() {
            saveApproved("Hotel-0m", CTR_LAT, CTR_LNG);

            NearbyHotelResponse res = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 5.0, 1).get(0);

            assertThat(res.getDistanceKm()).isLessThan(0.1);
        }

        @Test
        @DisplayName("distanceKm được làm tròn 2 chữ số thập phân")
        void distanceKm_roundedTo2DecimalPlaces() {
            saveApproved("Hotel-5km", CTR_LAT + latOffset(5.0), CTR_LNG);

            NearbyHotelResponse res = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 1).get(0);

            // distanceKm = Math.round(raw * 100.0) / 100.0 → tối đa 2 chữ số
            double d = res.getDistanceKm();
            assertThat(Math.round(d * 100.0) / 100.0).isEqualTo(d);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  4. Lọc trạng thái (chỉ APPROVED)
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Lọc status — chỉ trả về APPROVED")
    class StatusFilter {

        @Test
        @DisplayName("PENDING trong bán kính → bị loại, APPROVED được giữ")
        void pending_excluded_approved_included() {
            saveApproved("Approved-1km",                    CTR_LAT + latOffset(1.0), CTR_LNG);
            save("Pending-0.5km", CTR_LAT + latOffset(0.5), CTR_LNG, HotelStatus.PENDING);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 5.0, 20);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Approved-1km");
        }

        @Test
        @DisplayName("REJECTED và INACTIVE bị loại")
        void rejected_and_inactive_excluded() {
            saveApproved("Approved-2km",                    CTR_LAT + latOffset(2.0), CTR_LNG);
            save("Rejected-1km", CTR_LAT + latOffset(1.0), CTR_LNG, HotelStatus.REJECTED);
            save("Inactive-3km", CTR_LAT + latOffset(3.0), CTR_LNG, HotelStatus.INACTIVE);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 20);

            List<String> names = result.stream().map(NearbyHotelResponse::getName).toList();
            assertThat(names).containsOnly("Approved-2km");
        }

        @Test
        @DisplayName("Chỉ có PENDING trong DB → kết quả rỗng")
        void onlyPendingInDb_returnsEmpty() {
            save("Pending-1km", CTR_LAT + latOffset(1.0), CTR_LNG, HotelStatus.PENDING);
            save("Pending-3km", CTR_LAT + latOffset(3.0), CTR_LNG, HotelStatus.PENDING);

            assertThat(hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 20)).isEmpty();
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  5. Tham số limit
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Tham số limit")
    class LimitParameter {

        @Test
        @DisplayName("limit=2 — chỉ trả về 2 hotel gần nhất")
        void limit2_returns2NearestHotels() {
            saveApproved("Hotel-1km",  CTR_LAT + latOffset(1.0), CTR_LNG);
            saveApproved("Hotel-3km",  CTR_LAT + latOffset(3.0), CTR_LNG);
            saveApproved("Hotel-7km",  CTR_LAT + latOffset(7.0), CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 2);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).getName()).isEqualTo("Hotel-1km");
            assertThat(result.get(1).getName()).isEqualTo("Hotel-3km");
        }

        @Test
        @DisplayName("limit=1 — chỉ trả về hotel gần nhất")
        void limit1_returnsOnlyNearestHotel() {
            saveApproved("Hotel-5km",  CTR_LAT + latOffset(5.0), CTR_LNG);
            saveApproved("Hotel-1km",  CTR_LAT + latOffset(1.0), CTR_LNG);
            saveApproved("Hotel-3km",  CTR_LAT + latOffset(3.0), CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 1);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Hotel-1km");
        }

        @Test
        @DisplayName("limit lớn hơn số kết quả thực tế — trả về tất cả")
        void limitLargerThanResults_returnsAll() {
            saveApproved("Hotel-1km", CTR_LAT + latOffset(1.0), CTR_LNG);
            saveApproved("Hotel-3km", CTR_LAT + latOffset(3.0), CTR_LNG);

            List<NearbyHotelResponse> result = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 100);

            assertThat(result).hasSize(2);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  6. Response fields
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("NearbyHotelResponse chứa đầy đủ id, name, status, location, distanceKm")
    void responseFields_allPopulated() {
        saveApproved("Grand Hanoi Hotel", CTR_LAT + latOffset(2.0), CTR_LNG);

        NearbyHotelResponse res = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 5.0, 1).get(0);

        assertThat(res.getId()).isNotBlank();
        assertThat(res.getName()).isEqualTo("Grand Hanoi Hotel");
        assertThat(res.getStatus()).isEqualTo(HotelStatus.APPROVED);
        assertThat(res.getLocation()).isNotNull();
        assertThat(res.getLocation().getCoordinates()).hasSize(2);
        assertThat(res.getDistanceKm()).isNotNull().isGreaterThan(0);
    }

    @Test
    @DisplayName("location.coordinates lưu đúng thứ tự [lng, lat] theo chuẩn GeoJSON")
    void location_geoJsonOrder_lngBeforeLat() {
        double hotelLat = CTR_LAT + latOffset(2.0);
        double hotelLng = CTR_LNG + 0.01;   // dịch 0.01° về phía Đông để lng ≠ CTR_LNG
        save("Hotel-GeoJSON", hotelLat, hotelLng, HotelStatus.APPROVED);

        NearbyHotelResponse res = hotelService.getNearbyHotels(CTR_LAT, CTR_LNG, 10.0, 1).get(0);

        List<Double> coords = res.getLocation().getCoordinates();
        // coordinates[0] = longitude, coordinates[1] = latitude
        assertThat(coords.get(0)).isCloseTo(hotelLng, within(0.0001));
        assertThat(coords.get(1)).isCloseTo(hotelLat, within(0.0001));
    }
}
