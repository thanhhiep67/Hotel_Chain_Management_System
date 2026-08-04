package com.example.Back_End.service;

import com.example.Back_End.dto.request.BookingRequest;
import com.example.Back_End.dto.response.BookingResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.model.Discount;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.*;
import com.example.Back_End.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.*;

/**
 * Integration test: BookingService + DiscountService với MongoDB thật.
 *
 * Chiến lược:
 *  - @DataMongoTest  → tất cả MongoRepository + MongoTemplate được nạp thật
 *  - @Import(...)    → BookingService và DiscountService được khởi tạo thật
 *  - @MockitoBean    → mock các bean ngoài: WebSocket, email, notification
 *
 * @Caching trên createBooking() bị bỏ qua trong slice này vì
 * @EnableCaching không được kích hoạt bởi @DataMongoTest.
 */
@DataMongoTest
@Import({ BookingService.class, DiscountService.class })
@TestPropertySource(properties = "booking.cancel.min-days-before=1")
@DisplayName("Integration: Booking + Discount flow")
class BookingDiscountIntegrationTest {

    // ── services + repos được nạp thật ──────────────────────────────────────

    @Autowired BookingService     bookingService;
    @Autowired BookingRepository  bookingRepository;
    @Autowired DiscountRepository discountRepository;
    @Autowired UserRepository     userRepository;
    @Autowired RoomRepository     roomRepository;
    @Autowired HotelRepository    hotelRepository;

    // ── mock các bean ngoài không liên quan đến logic giá ───────────────────

    @MockitoBean SimpMessagingTemplate messagingTemplate;
    @MockitoBean NotificationService   notificationService;
    @MockitoBean EmailService          emailService;
    @MockitoBean MessageService        messageService;

    // ── dữ liệu dùng chung ──────────────────────────────────────────────────

    /** Khách sạn mặc định để gắn phòng */
    private Hotel savedHotel;
    /** Phòng 500k/đêm, status AVAILABLE */
    private Room  savedRoom;

    // ── setup: xóa sạch + chèn dữ liệu nền trước mỗi test ──────────────────

    @BeforeEach
    void setUp() {
        bookingRepository.deleteAll();
        discountRepository.deleteAll();
        userRepository.deleteAll();
        roomRepository.deleteAll();
        hotelRepository.deleteAll();

        savedHotel = hotelRepository.save(Hotel.builder()
                .ownerId("owner-001")
                .name("Test Hotel")
                .city("Hà Nội")
                .build());

        savedRoom = roomRepository.save(Room.builder()
                .hotelId(savedHotel.getId())
                .roomNumber("101")
                .pricePerNight(500_000.0)
                .status(RoomStatus.AVAILABLE)
                .build());

        userRepository.save(User.builder()
                .email("user@test.com")
                .fullName("Test User")
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .build());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /**
     * Tạo và lưu Discount ACTIVE, hiệu lực ngày hôm qua → 30 ngày sau.
     * @param usedCount số lượt đã dùng ban đầu
     */
    private Discount saveDiscount(String code, DiscountType type, double value,
                                   double minOrderAmount, Double maxDiscount,
                                   int usageLimit, int usedCount) {
        return discountRepository.save(Discount.builder()
                .code(code)
                .name("Test – " + code)
                .type(type)
                .value(value)
                .minOrderAmount(minOrderAmount)
                .maxDiscount(maxDiscount)
                .usageLimit(usageLimit)
                .usedCount(usedCount)
                .status(DiscountStatus.ACTIVE)
                .startDate(LocalDate.now().minusDays(1))
                .endDate(LocalDate.now().plusDays(30))
                .build());
    }

    /**
     * BookingRequest chuẩn: phòng savedRoom, ngày mai → ngày kia (2 đêm).
     */
    private BookingRequest stdRequest(String discountCode) {
        BookingRequest req = new BookingRequest();
        req.setRoomId(savedRoom.getId());
        req.setCheckIn(LocalDate.now().plusDays(1));
        req.setCheckOut(LocalDate.now().plusDays(3));   // 2 đêm
        req.setGuestCount(2);
        req.setDiscountCode(discountCode);
        return req;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  1. Giảm phần trăm (PERCENTAGE)
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("PERCENTAGE discount")
    class PercentageDiscount {

        @Test
        @DisplayName("20% — 2đêm×500k=1tr → giảm 200k → tổng 800k; usedCount 0→1")
        void basic_20percent() {
            saveDiscount("SAVE20", DiscountType.PERCENTAGE, 20.0, 0, null, 10, 0);

            BookingResponse res = bookingService.createBooking("user@test.com", stdRequest("SAVE20"));

            assertThat(res.getOriginalPrice()).isEqualTo(1_000_000.0);
            assertThat(res.getDiscountAmount()).isEqualTo(200_000.0);
            assertThat(res.getTotalPrice()).isEqualTo(800_000.0);

            // xác minh $inc đã cộng usedCount trong MongoDB
            int usedCount = discountRepository.findByCode("SAVE20").orElseThrow().getUsedCount();
            assertThat(usedCount).isEqualTo(1);
        }

        @Test
        @DisplayName("30% bị cap 200k — 30% of 1tr=300k nhưng maxDiscount=200k → tổng 800k")
        void capped_by_maxDiscount() {
            saveDiscount("CAP30", DiscountType.PERCENTAGE, 30.0, 0, 200_000.0, 5, 0);

            BookingResponse res = bookingService.createBooking("user@test.com", stdRequest("CAP30"));

            assertThat(res.getDiscountAmount()).isEqualTo(200_000.0);
            assertThat(res.getTotalPrice()).isEqualTo(800_000.0);

            assertThat(discountRepository.findByCode("CAP30").orElseThrow().getUsedCount()).isEqualTo(1);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  2. Giảm cố định (FIXED_AMOUNT)
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("FIXED_AMOUNT discount")
    class FixedAmountDiscount {

        @Test
        @DisplayName("Giảm 150k — 2đêm×500k=1tr → tổng 850k; usedCount 0→1")
        void fixed_150k() {
            saveDiscount("FIX150", DiscountType.FIXED_AMOUNT, 150_000.0, 0, null, 10, 0);

            BookingResponse res = bookingService.createBooking("user@test.com", stdRequest("FIX150"));

            assertThat(res.getOriginalPrice()).isEqualTo(1_000_000.0);
            assertThat(res.getDiscountAmount()).isEqualTo(150_000.0);
            assertThat(res.getTotalPrice()).isEqualTo(850_000.0);

            assertThat(discountRepository.findByCode("FIX150").orElseThrow().getUsedCount()).isEqualTo(1);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  3. Không dùng discount
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Không có discountCode → originalPrice = totalPrice, discountAmount = 0")
    void noDiscount_priceUnchanged() {
        BookingResponse res = bookingService.createBooking("user@test.com", stdRequest(null));

        assertThat(res.getOriginalPrice()).isEqualTo(1_000_000.0);
        assertThat(res.getDiscountAmount()).isEqualTo(0.0);
        assertThat(res.getTotalPrice()).isEqualTo(1_000_000.0);
        // discountId phải null (không có mã)
        assertThat(res.getDiscountId()).isNull();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  4. usedCount tăng đúng khi apply nhiều booking khác nhau
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("3 booking riêng lẻ với cùng mã → usedCount = 3")
    void usedCount_incrementsPerBooking() {
        saveDiscount("MULTI", DiscountType.FIXED_AMOUNT, 50_000.0, 0, null, 10, 0);

        // Cần 3 phòng khác nhau để tránh xung đột lịch
        Room r2 = roomRepository.save(Room.builder()
                .hotelId(savedHotel.getId()).roomNumber("102")
                .pricePerNight(500_000.0).status(RoomStatus.AVAILABLE).build());
        Room r3 = roomRepository.save(Room.builder()
                .hotelId(savedHotel.getId()).roomNumber("103")
                .pricePerNight(500_000.0).status(RoomStatus.AVAILABLE).build());

        bookingService.createBooking("user@test.com", stdRequest("MULTI"));

        BookingRequest req2 = new BookingRequest();
        req2.setRoomId(r2.getId());
        req2.setCheckIn(LocalDate.now().plusDays(1));
        req2.setCheckOut(LocalDate.now().plusDays(3));
        req2.setGuestCount(1);
        req2.setDiscountCode("MULTI");
        bookingService.createBooking("user@test.com", req2);

        BookingRequest req3 = new BookingRequest();
        req3.setRoomId(r3.getId());
        req3.setCheckIn(LocalDate.now().plusDays(1));
        req3.setCheckOut(LocalDate.now().plusDays(3));
        req3.setGuestCount(1);
        req3.setDiscountCode("MULTI");
        bookingService.createBooking("user@test.com", req3);

        int usedCount = discountRepository.findByCode("MULTI").orElseThrow().getUsedCount();
        assertThat(usedCount).isEqualTo(3);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  5. Các trường hợp discount không hợp lệ → AppException, usedCount giữ nguyên
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Discount không hợp lệ → AppException + usedCount không thay đổi")
    class InvalidDiscount {

        @Test
        @DisplayName("usageLimit đã đầy (usedCount = usageLimit) → exception")
        void exhaustedUsageLimit_throwsException() {
            saveDiscount("FULL", DiscountType.PERCENTAGE, 10.0, 0, null, 5, 5); // usedCount = usageLimit

            assertThatThrownBy(() -> bookingService.createBooking("user@test.com", stdRequest("FULL")))
                    .isInstanceOf(AppException.class);

            // usedCount phải vẫn là 5 (không tăng khi exception)
            assertThat(discountRepository.findByCode("FULL").orElseThrow().getUsedCount()).isEqualTo(5);
        }

        @Test
        @DisplayName("minOrderAmount không đạt (đơn 1tr < yêu cầu 2tr) → exception")
        void minOrderAmount_notMet_throwsException() {
            saveDiscount("MIN2M", DiscountType.PERCENTAGE, 20.0, 2_000_000.0, null, 10, 0);

            assertThatThrownBy(() -> bookingService.createBooking("user@test.com", stdRequest("MIN2M")))
                    .isInstanceOf(AppException.class);

            assertThat(discountRepository.findByCode("MIN2M").orElseThrow().getUsedCount()).isEqualTo(0);
        }

        @Test
        @DisplayName("Mã discount INACTIVE → exception")
        void inactiveDiscount_throwsException() {
            discountRepository.save(Discount.builder()
                    .code("INACTIVE")
                    .name("Inactive Discount")
                    .type(DiscountType.PERCENTAGE)
                    .value(15.0)
                    .minOrderAmount(0)
                    .usageLimit(10)
                    .usedCount(0)
                    .status(DiscountStatus.INACTIVE)   // ← không phải ACTIVE
                    .startDate(LocalDate.now().minusDays(1))
                    .endDate(LocalDate.now().plusDays(30))
                    .build());

            assertThatThrownBy(() -> bookingService.createBooking("user@test.com", stdRequest("INACTIVE")))
                    .isInstanceOf(AppException.class);
        }

        @Test
        @DisplayName("Mã discount đã hết hạn (endDate hôm qua) → exception")
        void expiredDiscount_throwsException() {
            discountRepository.save(Discount.builder()
                    .code("EXPIRED")
                    .name("Expired Discount")
                    .type(DiscountType.PERCENTAGE)
                    .value(20.0)
                    .minOrderAmount(0)
                    .usageLimit(10)
                    .usedCount(0)
                    .status(DiscountStatus.ACTIVE)
                    .startDate(LocalDate.now().minusDays(10))
                    .endDate(LocalDate.now().minusDays(1))  // ← đã qua
                    .build());

            assertThatThrownBy(() -> bookingService.createBooking("user@test.com", stdRequest("EXPIRED")))
                    .isInstanceOf(AppException.class);
        }

        @Test
        @DisplayName("Mã không tồn tại → exception")
        void unknownCode_throwsException() {
            assertThatThrownBy(() -> bookingService.createBooking("user@test.com", stdRequest("NOTEXIST")))
                    .isInstanceOf(AppException.class);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  6. Booking lưu đúng discountId trong document
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Booking lưu đúng discountId tham chiếu đến document Discount")
    void booking_storesCorrectDiscountId() {
        Discount discount = saveDiscount("REF20", DiscountType.PERCENTAGE, 20.0, 0, null, 10, 0);

        BookingResponse res = bookingService.createBooking("user@test.com", stdRequest("REF20"));

        // discountId trong booking phải trỏ đúng _id của Discount document
        assertThat(res.getDiscountId()).isEqualTo(discount.getId());

        // Đồng thời tính giá đúng
        assertThat(res.getDiscountAmount()).isEqualTo(200_000.0);
    }
}
