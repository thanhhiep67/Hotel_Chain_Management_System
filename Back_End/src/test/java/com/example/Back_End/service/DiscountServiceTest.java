package com.example.Back_End.service;

import com.example.Back_End.dto.request.ValidateDiscountRequest;
import com.example.Back_End.dto.response.ValidateDiscountResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Discount;
import com.example.Back_End.model.enums.DiscountStatus;
import com.example.Back_End.model.enums.DiscountType;
import com.example.Back_End.repository.DiscountRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Unit tests for DiscountService.validate() / checkApplicable() / calculate().
 *
 * Scenarios covered:
 *   1. Hết hạn   — status EXPIRED, endDate past, startDate future, status INACTIVE
 *   2. Hết lượt  — usedCount >= usageLimit (global cap)
 *   3. Chưa đủ minBookingValue — orderAmount < minOrderAmount
 *   4. Hotel scope — discount scoped to a different hotel (DISCOUNT_NOT_APPLICABLE)
 *
 * Note: the Discount model has no perUserLimit field. The closest concept in the
 * current implementation is the global usageLimit. If per-user tracking is added
 * later, tests for it belong in a separate nested class.
 */
@ExtendWith(MockitoExtension.class)
class DiscountServiceTest {

    @Mock DiscountRepository discountRepository;
    @Mock HotelRepository    hotelRepository;
    @Mock UserRepository     userRepository;
    @Mock MongoTemplate      mongoTemplate;

    @InjectMocks
    DiscountService discountService;

    private static final String CODE     = "SALE10";
    private static final String HOTEL_ID = "hotel-1";

    // ─── Builder helper ────────────────────────────────────────────────────────────
    // Creates a baseline ACTIVE discount, valid today, no usage cap, 0 minOrder.
    private Discount.DiscountBuilder baseDiscount() {
        return Discount.builder()
                .id("disc-1")
                .code(CODE)
                .name("Sale 10%")
                .type(DiscountType.PERCENTAGE)
                .value(10.0)
                .minOrderAmount(0)
                .status(DiscountStatus.ACTIVE)
                .startDate(LocalDate.now().minusDays(1))
                .endDate(LocalDate.now().plusDays(30));
    }

    private void stubCode(Discount discount) {
        when(discountRepository.findByCode(CODE)).thenReturn(Optional.of(discount));
    }

    private ValidateDiscountRequest req(double amount) {
        ValidateDiscountRequest r = new ValidateDiscountRequest();
        r.setCode(CODE);
        r.setHotelId(HOTEL_ID);
        r.setOrderAmount(amount);
        return r;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. HẾT HẠN
    // ─────────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("1. Hết hạn — discount bị từ chối vì quá hạn / chưa bắt đầu")
    class Expired {

        @Test
        @DisplayName("status = EXPIRED → DISCOUNT_EXPIRED")
        void statusExpiredThrows() {
            stubCode(baseDiscount().status(DiscountStatus.EXPIRED).build());

            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_EXPIRED));
        }

        @Test
        @DisplayName("endDate đã qua (ngày hôm qua) → DISCOUNT_EXPIRED")
        void endDateInPastThrows() {
            Discount d = baseDiscount()
                    .startDate(LocalDate.now().minusDays(10))
                    .endDate(LocalDate.now().minusDays(1)) // hết hạn hôm qua
                    .build();
            stubCode(d);

            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_EXPIRED));
        }

        @Test
        @DisplayName("startDate chưa đến (ngày mai) → DISCOUNT_EXPIRED")
        void startDateInFutureThrows() {
            Discount d = baseDiscount()
                    .startDate(LocalDate.now().plusDays(1)) // chưa bắt đầu
                    .endDate(LocalDate.now().plusDays(30))
                    .build();
            stubCode(d);

            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_EXPIRED));
        }

        @Test
        @DisplayName("status = INACTIVE → DISCOUNT_INACTIVE")
        void statusInactiveThrows() {
            stubCode(baseDiscount().status(DiscountStatus.INACTIVE).build());

            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_INACTIVE));
        }

        @Test
        @DisplayName("Hôm nay đúng ngày endDate → vẫn hợp lệ (biên trên inclusive)")
        void endDateTodayIsStillValid() {
            Discount d = baseDiscount()
                    .endDate(LocalDate.now()) // đúng ngày hết hạn — vẫn ok
                    .usageLimit(null)
                    .build();
            stubCode(d);

            // Không ném exception — validate thành công
            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res).isNotNull();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. HẾT LƯỢT (usageLimit)
    // ─────────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("2. Hết lượt — usedCount đạt hoặc vượt usageLimit")
    class UsageLimitReached {

        @Test
        @DisplayName("usedCount == usageLimit → DISCOUNT_USAGE_LIMIT_REACHED")
        void usedCountEqualsLimitThrows() {
            Discount d = baseDiscount()
                    .usageLimit(100)
                    .usedCount(100)
                    .build();
            stubCode(d);

            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_USAGE_LIMIT_REACHED));
        }

        @Test
        @DisplayName("usedCount > usageLimit → DISCOUNT_USAGE_LIMIT_REACHED")
        void usedCountExceedsLimitThrows() {
            Discount d = baseDiscount()
                    .usageLimit(50)
                    .usedCount(51)
                    .build();
            stubCode(d);

            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_USAGE_LIMIT_REACHED));
        }

        @Test
        @DisplayName("usedCount = usageLimit - 1 → vẫn còn lượt, không ném exception")
        void usedCountBelowLimitIsAllowed() {
            Discount d = baseDiscount()
                    .usageLimit(100)
                    .usedCount(99) // còn đúng 1 lượt
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res).isNotNull();
        }

        @Test
        @DisplayName("usageLimit = null (không giới hạn) → luôn hợp lệ bất kể usedCount")
        void nullUsageLimitMeansUnlimited() {
            Discount d = baseDiscount()
                    .usageLimit(null)
                    .usedCount(9_999_999) // dùng nhiều đến đâu cũng không bị chặn
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res).isNotNull();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. CHƯA ĐỦ MIN BOOKING VALUE
    // ─────────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("3. Chưa đủ minBookingValue — orderAmount < minOrderAmount")
    class MinOrderAmount {

        @Test
        @DisplayName("orderAmount < minOrderAmount → DISCOUNT_MIN_ORDER_NOT_MET")
        void belowMinOrderThrows() {
            Discount d = baseDiscount()
                    .minOrderAmount(500_000)
                    .build();
            stubCode(d);

            assertThatThrownBy(() -> discountService.validate(req(499_999)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_MIN_ORDER_NOT_MET));
        }

        @Test
        @DisplayName("orderAmount == minOrderAmount → đúng ngưỡng, không ném exception")
        void exactMinOrderIsAllowed() {
            Discount d = baseDiscount()
                    .minOrderAmount(500_000)
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res).isNotNull();
        }

        @Test
        @DisplayName("orderAmount > minOrderAmount → hợp lệ")
        void aboveMinOrderIsAllowed() {
            Discount d = baseDiscount()
                    .minOrderAmount(200_000)
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res).isNotNull();
        }

        @Test
        @DisplayName("minOrderAmount = 0 (mặc định) → bất kỳ orderAmount nào cũng hợp lệ")
        void zeroMinOrderAlwaysPasses() {
            Discount d = baseDiscount()
                    .minOrderAmount(0)
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(1)); // 1₫ cũng pass
            assertThat(res).isNotNull();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. PHẠM VI ÁP DỤNG / HOTEL SCOPE
    // (Note: model hiện tại không có perUserLimit — usageLimit là giới hạn toàn cục.
    //  Giới hạn theo phạm vi hiện được thực hiện qua hotelId.)
    // ─────────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("4. Phạm vi áp dụng — discount scoped to specific hotel")
    class HotelScope {

        @Test
        @DisplayName("Discount của hotel khác → DISCOUNT_NOT_APPLICABLE")
        void discountForDifferentHotelThrows() {
            Discount d = baseDiscount()
                    .hotelId("hotel-OTHER") // chỉ áp dụng cho hotel-OTHER
                    .build();
            stubCode(d);

            // req gửi hotelId = HOTEL_ID = "hotel-1" → không khớp
            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_NOT_APPLICABLE));
        }

        @Test
        @DisplayName("Discount đúng hotel → hợp lệ")
        void discountForSameHotelIsAllowed() {
            Discount d = baseDiscount()
                    .hotelId(HOTEL_ID) // khớp với hotel trong request
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res).isNotNull();
        }

        @Test
        @DisplayName("Discount toàn hệ thống (hotelId = null) → áp dụng cho mọi hotel")
        void globalDiscountAppliesToAnyHotel() {
            Discount d = baseDiscount()
                    .hotelId(null) // không giới hạn hotel
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res).isNotNull();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. TÍNH SỐ TIỀN GIẢM (calculate)
    // ─────────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("5. Tính số tiền giảm — calculate()")
    class Calculate {

        @Test
        @DisplayName("PERCENTAGE 10% trên 1,000,000₫ → giảm 100,000₫")
        void percentageWithoutCap() {
            Discount d = baseDiscount()
                    .type(DiscountType.PERCENTAGE)
                    .value(10.0)
                    .maxDiscount(null) // không có trần
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(1_000_000));
            assertThat(res.getDiscountAmount()).isCloseTo(100_000.0, within(0.01));
            assertThat(res.getFinalPrice()).isCloseTo(900_000.0, within(0.01));
        }

        @Test
        @DisplayName("PERCENTAGE 50% nhưng maxDiscount = 200,000₫ → bị trần ở 200,000₫")
        void percentageCappedByMaxDiscount() {
            Discount d = baseDiscount()
                    .type(DiscountType.PERCENTAGE)
                    .value(50.0)       // 50% của 1,000,000 = 500,000
                    .maxDiscount(200_000.0) // nhưng trần là 200,000
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(1_000_000));
            assertThat(res.getDiscountAmount()).isCloseTo(200_000.0, within(0.01));
            assertThat(res.getFinalPrice()).isCloseTo(800_000.0, within(0.01));
        }

        @Test
        @DisplayName("FIXED_AMOUNT 150,000₫ → giảm đúng 150,000₫ bất kể % orderAmount")
        void fixedAmountType() {
            Discount d = baseDiscount()
                    .type(DiscountType.FIXED_AMOUNT)
                    .value(150_000.0)
                    .maxDiscount(null)
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            assertThat(res.getDiscountAmount()).isCloseTo(150_000.0, within(0.01));
            assertThat(res.getFinalPrice()).isCloseTo(350_000.0, within(0.01));
        }

        @Test
        @DisplayName("Giảm FIXED_AMOUNT lớn hơn orderAmount → discount bị trần ở orderAmount (không hoàn tiền)")
        void fixedAmountExceedsOrderAmount_cappedToOrderAmount() {
            Discount d = baseDiscount()
                    .type(DiscountType.FIXED_AMOUNT)
                    .value(999_999.0) // lớn hơn orderAmount
                    .maxDiscount(null)
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(100_000));
            // Không được giảm nhiều hơn orderAmount
            assertThat(res.getDiscountAmount()).isCloseTo(100_000.0, within(0.01));
            assertThat(res.getFinalPrice()).isCloseTo(0.0, within(0.01));
        }

        @Test
        @DisplayName("PERCENTAGE: maxDiscount không ảnh hưởng FIXED_AMOUNT")
        void maxDiscountIgnoredForFixedAmount() {
            // maxDiscount chỉ áp dụng cho PERCENTAGE, không cho FIXED_AMOUNT
            Discount d = baseDiscount()
                    .type(DiscountType.FIXED_AMOUNT)
                    .value(100_000.0)
                    .maxDiscount(50_000.0) // phải bị bỏ qua
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(500_000));
            // FIXED_AMOUNT bỏ qua maxDiscount → giảm đúng 100,000
            assertThat(res.getDiscountAmount()).isCloseTo(100_000.0, within(0.01));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. HAPPY PATH — validate thành công end-to-end
    // ─────────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("6. Happy path — validate trả về response đầy đủ")
    class HappyPath {

        @Test
        @DisplayName("Discount hợp lệ → response chứa đúng discountId, code, amount")
        void validDiscountReturnsCorrectResponse() {
            Discount d = baseDiscount()
                    .type(DiscountType.PERCENTAGE)
                    .value(20.0)
                    .usageLimit(null)
                    .build();
            stubCode(d);

            ValidateDiscountResponse res = discountService.validate(req(1_000_000));

            assertThat(res.getDiscountId()).isEqualTo("disc-1");
            assertThat(res.getCode()).isEqualTo(CODE);
            assertThat(res.getDiscountAmount()).isCloseTo(200_000.0, within(0.01));
            assertThat(res.getFinalPrice()).isCloseTo(800_000.0, within(0.01));
        }

        @Test
        @DisplayName("Mã không tồn tại → DISCOUNT_NOT_FOUND")
        void unknownCodeThrows() {
            when(discountRepository.findByCode(anyString())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> discountService.validate(req(500_000)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.DISCOUNT_NOT_FOUND));
        }
    }
}
