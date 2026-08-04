package com.example.Back_End.service;

import com.example.Back_End.dto.request.PaymentCreateRequest;
import com.example.Back_End.dto.response.PaymentNotification;
import com.example.Back_End.dto.response.PaymentResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Payment;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.PaymentMethod;
import com.example.Back_End.model.enums.PaymentStatus;
import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.model.enums.UserStatus;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.PaymentRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Integration test: Payment flow — PaymentService với MongoDB thật.
 *
 * Chiến lược:
 *  - @DataMongoTest  → tất cả MongoRepository + MongoTemplate nạp thật
 *  - @Import(PaymentService.class) → service khởi tạo với repo thật
 *  - @MockitoBean VNPayService     → không gọi HTTP ra ngoài
 *  - @MockitoBean SimpMessagingTemplate, EmailService → verify được call
 *
 * Bao phủ:
 *  1. createPayment — CASH, VNPAY, idempotency, guard checks
 *  2. processCallback SUCCESS — status, booking, WS x2, email, payload
 *  3. processCallback FAILED  — status, WS, email KHÔNG gửi
 *  4. processCallback guards  — chữ ký sai, amount bị sửa, đã xử lý rồi
 */
@DataMongoTest
@Import(PaymentService.class)
@DisplayName("Integration: Payment flow")
class PaymentFlowIntegrationTest {

    // ── real beans ───────────────────────────────────────────────────────────

    @Autowired PaymentService    paymentService;
    @Autowired PaymentRepository paymentRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired UserRepository    userRepository;
    @Autowired HotelRepository   hotelRepository;
    @Autowired RoomRepository    roomRepository;

    // ── mocks ────────────────────────────────────────────────────────────────

    @MockitoBean VNPayService          vnPayService;
    @MockitoBean SimpMessagingTemplate messagingTemplate;
    @MockitoBean EmailService          emailService;

    // ── shared test fixtures ─────────────────────────────────────────────────

    private User    savedUser;
    private Hotel   savedHotel;
    private Room    savedRoom;
    private Booking savedBooking;

    private static final double BOOKING_TOTAL = 1_000_000.0;

    @BeforeEach
    void setUp() {
        paymentRepository.deleteAll();
        bookingRepository.deleteAll();
        userRepository.deleteAll();
        hotelRepository.deleteAll();
        roomRepository.deleteAll();

        savedHotel = hotelRepository.save(Hotel.builder()
                .ownerId("owner-001").name("Test Hotel").city("Hà Nội").build());

        savedRoom = roomRepository.save(Room.builder()
                .hotelId(savedHotel.getId()).roomNumber("101")
                .pricePerNight(500_000.0).status(RoomStatus.AVAILABLE).build());

        savedUser = userRepository.save(User.builder()
                .email("user@test.com").fullName("Test User")
                .role(UserRole.USER).status(UserStatus.ACTIVE).build());

        savedBooking = bookingRepository.save(Booking.builder()
                .userId(savedUser.getId())
                .roomId(savedRoom.getId())
                .hotelId(savedHotel.getId())
                .checkIn(LocalDate.now().plusDays(1))
                .checkOut(LocalDate.now().plusDays(3))
                .guestCount(2)
                .originalPrice(BOOKING_TOTAL)
                .discountAmount(0.0)
                .totalPrice(BOOKING_TOTAL)
                .status(BookingStatus.PENDING)
                .paymentStatus(PaymentStatus.UNPAID)
                .createdAt(LocalDateTime.now())
                .build());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private PaymentCreateRequest cashReq() {
        return new PaymentCreateRequest(savedBooking.getId(), PaymentMethod.CASH, null, null);
    }

    private PaymentCreateRequest vnpayReq() {
        return new PaymentCreateRequest(savedBooking.getId(), PaymentMethod.VNPAY, null, "vn");
    }

    /**
     * Xây params giả lập callback từ VNPay gateway.
     * amount là số VND thực (service tự nhân 100 khi gửi, chia 100 khi nhận).
     */
    private Map<String, String> vnpayParams(String paymentId, String responseCode,
                                             String txnNo, double amountVnd) {
        Map<String, String> p = new HashMap<>();
        p.put("vnp_TxnRef",        paymentId);
        p.put("vnp_ResponseCode",  responseCode);
        p.put("vnp_TransactionNo", txnNo);
        // VNPay truyền amount * 100 (đơn vị 1/100 VND)
        p.put("vnp_Amount",        String.valueOf((long) (amountVnd * 100)));
        p.put("vnp_SecureHash",    "dummy-hash");
        return p;
    }

    /** Lưu một Payment PENDING để dùng trong callback tests. */
    private Payment savePendingVnpayPayment() {
        return paymentRepository.save(Payment.builder()
                .bookingId(savedBooking.getId())
                .userId(savedUser.getId())
                .method(PaymentMethod.VNPAY)
                .amount(BOOKING_TOTAL)
                .currency("VND")
                .status(PaymentStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build());
    }

    // ════════════════════════════════════════════════════════════════════════
    //  1. createPayment
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("createPayment")
    class CreatePayment {

        @Test
        @DisplayName("CASH — tạo Payment PENDING, không gọi VNPay gateway")
        void cash_createsPendingPayment_noGatewayCall() {
            PaymentResponse res = paymentService.createPayment("user@test.com", cashReq(), "127.0.0.1");

            assertThat(res.getStatus()).isEqualTo(PaymentStatus.PENDING);
            assertThat(res.getMethod()).isEqualTo(PaymentMethod.CASH);
            assertThat(res.getAmount()).isEqualTo(BOOKING_TOTAL);
            assertThat(res.getBookingId()).isEqualTo(savedBooking.getId());
            assertThat(res.getPaymentUrl()).isNull();

            verify(vnPayService, never()).buildPaymentUrl(any(), anyLong(), any(), any(), any(), any());
            assertThat(paymentRepository.findAll()).hasSize(1);
        }

        @Test
        @DisplayName("VNPAY — gọi buildPaymentUrl với đúng amount, trả về paymentUrl")
        void vnpay_buildsPaymentUrl_withCorrectAmount() {
            when(vnPayService.buildPaymentUrl(any(), anyLong(), any(), any(), any(), any()))
                    .thenReturn("https://sandbox.vnpay.vn/pay?token=abc");

            PaymentResponse res = paymentService.createPayment("user@test.com", vnpayReq(), "127.0.0.1");

            assertThat(res.getStatus()).isEqualTo(PaymentStatus.PENDING);
            assertThat(res.getMethod()).isEqualTo(PaymentMethod.VNPAY);
            assertThat(res.getPaymentUrl()).isEqualTo("https://sandbox.vnpay.vn/pay?token=abc");

            // amount phải được chuyển đổi sang long (1_000_000L)
            verify(vnPayService).buildPaymentUrl(any(), eq(1_000_000L), any(), any(), any(), any());
        }

        @Test
        @DisplayName("VNPAY idempotency — gọi lần 2 trả về payment cũ, không tạo thêm document")
        void vnpay_idempotency_reusesPendingPayment() {
            when(vnPayService.buildPaymentUrl(any(), anyLong(), any(), any(), any(), any()))
                    .thenReturn("https://sandbox.vnpay.vn/pay?token=xyz");

            PaymentResponse first  = paymentService.createPayment("user@test.com", vnpayReq(), "127.0.0.1");
            PaymentResponse second = paymentService.createPayment("user@test.com", vnpayReq(), "127.0.0.1");

            assertThat(first.getPaymentId()).isEqualTo(second.getPaymentId());
            // buildPaymentUrl chỉ gọi 1 lần
            verify(vnPayService, times(1)).buildPaymentUrl(any(), anyLong(), any(), any(), any(), any());
            assertThat(paymentRepository.findAll()).hasSize(1);
        }

        @Test
        @DisplayName("Booking đã PAID → AppException (không tạo payment mới)")
        void alreadyPaidBooking_throwsException() {
            savedBooking.setPaymentStatus(PaymentStatus.PAID);
            bookingRepository.save(savedBooking);

            assertThatThrownBy(() -> paymentService.createPayment("user@test.com", cashReq(), "127.0.0.1"))
                    .isInstanceOf(AppException.class);
            assertThat(paymentRepository.findAll()).isEmpty();
        }

        @Test
        @DisplayName("Booking CANCELLED → AppException BOOKING_INVALID_STATUS")
        void cancelledBooking_throwsException() {
            savedBooking.setStatus(BookingStatus.CANCELLED);
            bookingRepository.save(savedBooking);

            assertThatThrownBy(() -> paymentService.createPayment("user@test.com", cashReq(), "127.0.0.1"))
                    .isInstanceOf(AppException.class);
        }

        @Test
        @DisplayName("Booking thuộc user khác → AppException BOOKING_ACCESS_DENIED")
        void differentUserBooking_throwsException() {
            userRepository.save(User.builder()
                    .email("other@test.com").fullName("Other")
                    .role(UserRole.USER).status(UserStatus.ACTIVE).build());

            assertThatThrownBy(() -> paymentService.createPayment(
                    "other@test.com",
                    new PaymentCreateRequest(savedBooking.getId(), PaymentMethod.CASH, null, null),
                    "127.0.0.1"))
                    .isInstanceOf(AppException.class);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  2. processCallback — SUCCESS (vnp_ResponseCode = "00")
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("processCallback — SUCCESS path")
    class CallbackSuccess {

        private Payment pendingPayment;

        @BeforeEach
        void setup() {
            pendingPayment = savePendingVnpayPayment();
            when(vnPayService.verifySignature(any())).thenReturn(true);
        }

        @Test
        @DisplayName("Payment status → PAID, paidAt được set, transactionId được lưu")
        void payment_markedPaid_withTransactionId() {
            paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "VNP_TXN_001", BOOKING_TOTAL));

            Payment updated = paymentRepository.findById(pendingPayment.getId()).orElseThrow();
            assertThat(updated.getStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(updated.getPaidAt()).isNotNull();
            assertThat(updated.getTransactionId()).isEqualTo("VNP_TXN_001");
        }

        @Test
        @DisplayName("Booking.paymentStatus → PAID")
        void booking_paymentStatus_updatedToPaid() {
            paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN_002", BOOKING_TOTAL));

            Booking b = bookingRepository.findById(savedBooking.getId()).orElseThrow();
            assertThat(b.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);
        }

        @Test
        @DisplayName("WebSocket emit đến /queue/notifications (user) + /topic/hotel/{id} (hotel)")
        void webSocket_emittedToUserQueueAndHotelTopic() {
            paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN_003", BOOKING_TOTAL));

            verify(messagingTemplate).convertAndSendToUser(
                    eq(savedUser.getEmail()), eq("/queue/notifications"), any());

            verify(messagingTemplate).convertAndSend(
                    eq("/topic/hotel/" + savedHotel.getId()), any(Object.class));
        }

        @Test
        @DisplayName("Email xác nhận được gửi sau SUCCESS")
        void email_sentOnSuccess() {
            paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN_004", BOOKING_TOTAL));

            verify(emailService).sendPaymentConfirmEmail(
                    any(User.class), any(Booking.class),
                    any(Room.class), any(Hotel.class), any(Payment.class));
        }

        @Test
        @DisplayName("WS payload chứa đúng eventType=PAYMENT_SUCCESS, status=PAID, amount=1tr")
        void webSocket_notificationPayload_correctFields() {
            paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN_005", BOOKING_TOTAL));

            ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSendToUser(any(), any(), captor.capture());

            PaymentNotification n = (PaymentNotification) captor.getValue();
            assertThat(n.getEventType()).isEqualTo("PAYMENT_SUCCESS");
            assertThat(n.getStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(n.getAmount()).isEqualTo(BOOKING_TOTAL);
            assertThat(n.getBookingId()).isEqualTo(savedBooking.getId());
            assertThat(n.getHotelId()).isEqualTo(savedHotel.getId());
        }

        @Test
        @DisplayName("processCallback trả về IPN ack {RspCode:00}")
        void returns_ipnAck00() {
            Map<String, String> result = paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN_006", BOOKING_TOTAL));

            assertThat(result.get("RspCode")).isEqualTo("00");
            assertThat(result.get("Message")).isEqualTo("Confirm Success");
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  3. processCallback — FAILED (responseCode ≠ "00")
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("processCallback — FAILED path")
    class CallbackFailed {

        private Payment pendingPayment;

        @BeforeEach
        void setup() {
            pendingPayment = savePendingVnpayPayment();
            when(vnPayService.verifySignature(any())).thenReturn(true);
        }

        @Test
        @DisplayName("ResponseCode 24 (user huỷ) → payment FAILED, booking UNPAID, email KHÔNG gửi")
        void userCancelled_paymentFailed_noEmail() {
            paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "24", "", BOOKING_TOTAL));

            Payment updated = paymentRepository.findById(pendingPayment.getId()).orElseThrow();
            assertThat(updated.getStatus()).isEqualTo(PaymentStatus.FAILED);

            // Booking paymentStatus KHÔNG thay đổi
            assertThat(bookingRepository.findById(savedBooking.getId()).orElseThrow()
                    .getPaymentStatus()).isEqualTo(PaymentStatus.UNPAID);

            verify(emailService, never())
                    .sendPaymentConfirmEmail(any(), any(), any(), any(), any(Payment.class));
        }

        @Test
        @DisplayName("FAILED → WS vẫn emit với eventType=PAYMENT_FAILED")
        void failed_webSocketEmitted_withCorrectEventType() {
            paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "11", "", BOOKING_TOTAL));

            ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSendToUser(any(), any(), captor.capture());

            PaymentNotification n = (PaymentNotification) captor.getValue();
            assertThat(n.getEventType()).isEqualTo("PAYMENT_FAILED");
            assertThat(n.getStatus()).isEqualTo(PaymentStatus.FAILED);
        }

        @Test
        @DisplayName("IPN ack vẫn trả {RspCode:00} dù payment failed — VNPay spec")
        void ipnReturns00_evenOnGatewayFailure() {
            Map<String, String> result = paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "99", "", BOOKING_TOTAL));

            assertThat(result.get("RspCode")).isEqualTo("00");
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    //  4. processCallback — guard / error paths
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("processCallback — guards (signature, amount, idempotency)")
    class CallbackGuards {

        private Payment pendingPayment;

        @BeforeEach
        void setup() {
            pendingPayment = savePendingVnpayPayment();
        }

        @Test
        @DisplayName("Chữ ký không hợp lệ → RspCode 97, payment vẫn PENDING")
        void invalidSignature_error97_paymentUnchanged() {
            when(vnPayService.verifySignature(any())).thenReturn(false);

            Map<String, String> result = paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN", BOOKING_TOTAL));

            assertThat(result.get("RspCode")).isEqualTo("97");
            assertThat(paymentRepository.findById(pendingPayment.getId()).orElseThrow().getStatus())
                    .isEqualTo(PaymentStatus.PENDING);
            verifyNoInteractions(messagingTemplate, emailService);
        }

        @Test
        @DisplayName("Amount bị giả mạo (500k thay vì 1tr) → RspCode 04, không xử lý")
        void tamperedAmount_error04() {
            when(vnPayService.verifySignature(any())).thenReturn(true);

            Map<String, String> result = paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN", 500_000.0));

            assertThat(result.get("RspCode")).isEqualTo("04");
            assertThat(paymentRepository.findById(pendingPayment.getId()).orElseThrow().getStatus())
                    .isEqualTo(PaymentStatus.PENDING);
            verifyNoInteractions(messagingTemplate, emailService);
        }

        @Test
        @DisplayName("Payment đã PAID — IPN gọi lại → RspCode 02, không xử lý lại")
        void alreadyPaid_idempotency_error02() {
            when(vnPayService.verifySignature(any())).thenReturn(true);

            pendingPayment.setStatus(PaymentStatus.PAID);
            paymentRepository.save(pendingPayment);

            Map<String, String> result = paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN", BOOKING_TOTAL));

            assertThat(result.get("RspCode")).isEqualTo("02");
            verifyNoInteractions(messagingTemplate, emailService);
        }

        @Test
        @DisplayName("Payment đã FAILED — IPN gọi lại → RspCode 02")
        void alreadyFailed_idempotency_error02() {
            when(vnPayService.verifySignature(any())).thenReturn(true);

            pendingPayment.setStatus(PaymentStatus.FAILED);
            paymentRepository.save(pendingPayment);

            Map<String, String> result = paymentService.processCallback(
                    vnpayParams(pendingPayment.getId(), "00", "TXN", BOOKING_TOTAL));

            assertThat(result.get("RspCode")).isEqualTo("02");
        }

        @Test
        @DisplayName("vnp_TxnRef không tồn tại trong DB → RspCode 01")
        void unknownPaymentId_error01() {
            when(vnPayService.verifySignature(any())).thenReturn(true);

            Map<String, String> result = paymentService.processCallback(
                    vnpayParams("ghost-payment-id", "00", "TXN", BOOKING_TOTAL));

            assertThat(result.get("RspCode")).isEqualTo("01");
        }
    }
}
