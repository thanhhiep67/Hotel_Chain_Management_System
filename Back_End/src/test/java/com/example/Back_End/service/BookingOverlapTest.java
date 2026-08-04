package com.example.Back_End.service;

import com.example.Back_End.dto.request.BookingRequest;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.PaymentRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the booking overlap algorithm.
 *
 * Overlap condition (mirrors MongoDB derived query):
 *   existingCheckIn < newCheckOut  AND  existingCheckOut > newCheckIn
 *
 * Non-blocking statuses (excluded from conflict check):
 *   CANCELLED, REJECTED, CHECKED_OUT
 */
@ExtendWith(MockitoExtension.class)
class BookingOverlapTest {

    // ─── Pure predicate — mirrors the derived query condition ─────────────────────
    //   existsByRoomIdAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
    //       roomId, excluded, newCheckOut, newCheckIn)
    //   translates to: existCheckIn < newCheckOut AND existCheckOut > newCheckIn
    private static boolean overlaps(LocalDate existIn, LocalDate existOut,
                                    LocalDate newIn,   LocalDate newOut) {
        return existIn.isBefore(newOut) && existOut.isAfter(newIn);
    }

    // ─── Part 1: Pure predicate tests (no Spring, no Mockito) ────────────────────

    @Nested
    @DisplayName("Overlap predicate — pure logic")
    class PredicateTests {

        @Test
        @DisplayName("Chồng lịch: khoảng mới nằm trong khoảng cũ — bị block")
        void overlapsInMiddle() {
            // existing: Jan 1–5, new: Jan 3–7 → overlap Jan 3–5
            assertThat(overlaps(
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5),
                    LocalDate.of(2025, 1, 3), LocalDate.of(2025, 1, 7)))
                    .isTrue();
        }

        @Test
        @DisplayName("Chồng lịch: trùng hoàn toàn cùng ngày — bị block")
        void overlapsSameDates() {
            LocalDate in  = LocalDate.of(2025, 6, 10);
            LocalDate out = LocalDate.of(2025, 6, 15);
            assertThat(overlaps(in, out, in, out)).isTrue();
        }

        @Test
        @DisplayName("Chồng lịch: booking mới bao trùm booking cũ — bị block")
        void overlapsNewWrapsExisting() {
            // existing: Jan 5–10, new: Jan 3–15
            assertThat(overlaps(
                    LocalDate.of(2025, 1, 5), LocalDate.of(2025, 1, 10),
                    LocalDate.of(2025, 1, 3), LocalDate.of(2025, 1, 15)))
                    .isTrue();
        }

        @Test
        @DisplayName("Chồng lịch: chỉ đầu khoảng trùng — bị block")
        void overlapsAtStart() {
            // existing: Jan 5–10, new: Jan 1–7 → overlap Jan 5–7
            assertThat(overlaps(
                    LocalDate.of(2025, 1, 5), LocalDate.of(2025, 1, 10),
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 7)))
                    .isTrue();
        }

        @Test
        @DisplayName("Giáp lịch chính xác: checkout cũ = checkin mới — KHÔNG block")
        void adjacentCheckOutEqualsNewCheckIn_notBlocked() {
            // existing: Jan 1–5, new: Jan 5–8
            // existCheckOut(Jan5) > newCheckIn(Jan5)? → Jan5 > Jan5 is FALSE → no conflict
            assertThat(overlaps(
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5),
                    LocalDate.of(2025, 1, 5), LocalDate.of(2025, 1, 8)))
                    .isFalse();
        }

        @Test
        @DisplayName("Giáp lịch: checkout mới = checkin cũ — KHÔNG block")
        void adjacentNewCheckOutEqualsExistingCheckIn_notBlocked() {
            // existing: Jan 5–10, new: Jan 1–5
            // existCheckIn(Jan5) < newCheckOut(Jan5)? → Jan5 < Jan5 is FALSE → no conflict
            assertThat(overlaps(
                    LocalDate.of(2025, 1, 5), LocalDate.of(2025, 1, 10),
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5)))
                    .isFalse();
        }

        @Test
        @DisplayName("Không chồng: booking mới hoàn toàn sau — KHÔNG block")
        void noOverlapNewIsAfter() {
            // existing: Jan 1–5, new: Jan 6–10
            assertThat(overlaps(
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5),
                    LocalDate.of(2025, 1, 6), LocalDate.of(2025, 1, 10)))
                    .isFalse();
        }

        @Test
        @DisplayName("Không chồng: booking mới hoàn toàn trước — KHÔNG block")
        void noOverlapNewIsBefore() {
            // existing: Jan 6–10, new: Jan 1–5
            assertThat(overlaps(
                    LocalDate.of(2025, 1, 6), LocalDate.of(2025, 1, 10),
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 1, 5)))
                    .isFalse();
        }
    }

    // ─── Part 2: Service-level tests (Mockito) ───────────────────────────────────

    @Mock BookingRepository     bookingRepository;
    @Mock PaymentRepository     paymentRepository;
    @Mock RoomRepository        roomRepository;
    @Mock HotelRepository       hotelRepository;
    @Mock UserRepository        userRepository;
    @Mock SimpMessagingTemplate messagingTemplate;
    @Mock MongoTemplate         mongoTemplate;
    @Mock NotificationService   notificationService;
    @Mock EmailService          emailService;
    @Mock DiscountService       discountService;
    @Mock MessageService        messageService;

    @InjectMocks
    BookingService bookingService;

    private void stubUser(String email, String id) {
        User u = User.builder().id(id).email(email).build();
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(u));
    }

    private Room stubRoom(String roomId, String hotelId) {
        Room r = Room.builder()
                .id(roomId)
                .hotelId(hotelId)
                .status(RoomStatus.AVAILABLE)
                .pricePerNight(500_000.0)
                .build();
        when(roomRepository.findById(roomId)).thenReturn(Optional.of(r));
        return r;
    }

    private BookingRequest request(String roomId, LocalDate in, LocalDate out) {
        return new BookingRequest(roomId, in, out, 1, null, null);
    }

    @Nested
    @DisplayName("BookingService — conflict detection")
    class ServiceConflictTests {

        private static final String ROOM_ID  = "room-1";
        private static final String HOTEL_ID = "hotel-1";
        private static final String EMAIL    = "guest@test.com";
        private static final String USER_ID  = "user-1";

        private static final LocalDate CHECK_IN  = LocalDate.now().plusDays(5);
        private static final LocalDate CHECK_OUT = LocalDate.now().plusDays(10);

        @Test
        @DisplayName("Chồng lịch: repo trả true → ném BOOKING_CONFLICT")
        void throwsConflictWhenRepoReturnsTrue() {
            stubUser(EMAIL, USER_ID);
            stubRoom(ROOM_ID, HOTEL_ID);

            when(bookingRepository
                    .existsByRoomIdAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
                            eq(ROOM_ID), anyList(),
                            any(LocalDate.class), any(LocalDate.class)))
                    .thenReturn(true);

            assertThatThrownBy(() ->
                    bookingService.createBooking(EMAIL, request(ROOM_ID, CHECK_IN, CHECK_OUT)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.BOOKING_CONFLICT));
        }

        @Test
        @DisplayName("Booking đã hủy/từ chối không chặn: nonBlocking list phải chứa CANCELLED, REJECTED, CHECKED_OUT")
        void nonBlockingListExcludesCancelledAndRejected() {
            stubUser(EMAIL, USER_ID);
            stubRoom(ROOM_ID, HOTEL_ID);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<BookingStatus>> captor =
                    ArgumentCaptor.forClass(List.class);

            // Return true so the call throws early — we only care about the captured arg
            when(bookingRepository
                    .existsByRoomIdAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
                            eq(ROOM_ID), captor.capture(),
                            any(LocalDate.class), any(LocalDate.class)))
                    .thenReturn(true);

            try {
                bookingService.createBooking(EMAIL, request(ROOM_ID, CHECK_IN, CHECK_OUT));
            } catch (AppException ignored) {
                // Expected — we only want to inspect the argument
            }

            List<BookingStatus> excluded = captor.getValue();
            assertThat(excluded)
                    .as("CANCELLED bookings must be excluded from conflict check")
                    .contains(BookingStatus.CANCELLED);
            assertThat(excluded)
                    .as("REJECTED bookings must be excluded from conflict check")
                    .contains(BookingStatus.REJECTED);
            assertThat(excluded)
                    .as("CHECKED_OUT bookings must be excluded from conflict check")
                    .contains(BookingStatus.CHECKED_OUT);
        }

        @Test
        @DisplayName("Giáp lịch chính xác: repo trả false → không ném BOOKING_CONFLICT")
        void doesNotThrowConflictWhenRepoReturnsFalse() {
            stubUser(EMAIL, USER_ID);
            stubRoom(ROOM_ID, HOTEL_ID);

            // Repo returns false (no overlap, e.g. adjacent dates)
            when(bookingRepository
                    .existsByRoomIdAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
                            eq(ROOM_ID), anyList(),
                            any(LocalDate.class), any(LocalDate.class)))
                    .thenReturn(false);

            // Hotel not stubbed → will throw HOTEL_NOT_FOUND, which proves
            // the code passed the conflict check successfully
            when(hotelRepository.findById(anyString())).thenReturn(Optional.empty());

            assertThatThrownBy(() ->
                    bookingService.createBooking(EMAIL, request(ROOM_ID, CHECK_IN, CHECK_OUT)))
                    .isInstanceOf(AppException.class)
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .as("Must NOT be BOOKING_CONFLICT — code passed the overlap check")
                                    .isNotEqualTo(ErrorCode.BOOKING_CONFLICT))
                    .satisfies(ex ->
                            assertThat(((AppException) ex).getErrorCode())
                                    .isEqualTo(ErrorCode.HOTEL_NOT_FOUND));
        }
    }
}
