package com.example.Back_End.service;

import com.example.Back_End.dto.request.PaymentCreateRequest;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.PaymentNotification;
import com.example.Back_End.dto.response.PaymentResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Payment;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.PaymentMethod;
import com.example.Back_End.model.enums.PaymentStatus;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.PaymentRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository      paymentRepository;
    private final BookingRepository      bookingRepository;
    private final UserRepository         userRepository;
    private final HotelRepository        hotelRepository;
    private final RoomRepository         roomRepository;
    private final VNPayService           vnPayService;
    private final SimpMessagingTemplate  messagingTemplate;
    private final EmailService           emailService;

    // ── create ────────────────────────────────────────────────────────────────

    /**
     * Unified entry point: validate → dispatch to the correct gateway by method.
     */
    public PaymentResponse createPayment(String userEmail,
                                          PaymentCreateRequest request,
                                          String ipAddr) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUserId().equals(user.getId()))
            throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);

        if (booking.getPaymentStatus() == PaymentStatus.PAID)
            throw new AppException(ErrorCode.PAYMENT_ALREADY_PAID);

        if (booking.getStatus() == BookingStatus.CANCELLED
                || booking.getStatus() == BookingStatus.REJECTED)
            throw new AppException(ErrorCode.BOOKING_INVALID_STATUS);

        // Idempotency: reuse existing PENDING payment for the same method
        return paymentRepository
                .findByBookingIdAndStatus(request.getBookingId(), PaymentStatus.PENDING)
                .filter(p -> p.getMethod() == request.getMethod())
                .map(this::toResponse)
                .orElseGet(() -> buildGatewayPayment(user, booking, request, ipAddr));
    }

    /** Delegates to the gateway-specific builder based on method. */
    private PaymentResponse buildGatewayPayment(User user, Booking booking,
                                                  PaymentCreateRequest request,
                                                  String ipAddr) {
        return switch (request.getMethod()) {
            case VNPAY -> buildVNPayPayment(user, booking, ipAddr,
                    request.getBankCode(), request.getLocale());
            case CASH  -> buildCashPayment(user, booking);
            default    -> throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);
        };
    }

    private PaymentResponse buildVNPayPayment(User user, Booking booking,
                                               String ipAddr, String bankCode,
                                               String locale) {
        Payment payment = Payment.builder()
                .bookingId(booking.getId())
                .userId(user.getId())
                .method(PaymentMethod.VNPAY)
                .amount(booking.getTotalPrice())
                .currency("VND")
                .status(PaymentStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();
        payment = paymentRepository.save(payment);

        String orderInfo = "Thanh toan booking #" + booking.getId();
        String paymentUrl = vnPayService.buildPaymentUrl(
                payment.getId(),
                booking.getTotalPrice().longValue(),
                orderInfo, ipAddr, locale, bankCode);

        payment.setPaymentUrl(paymentUrl);
        paymentRepository.save(payment);

        return toResponse(payment);
    }

    private PaymentResponse buildCashPayment(User user, Booking booking) {
        Payment payment = Payment.builder()
                .bookingId(booking.getId())
                .userId(user.getId())
                .method(PaymentMethod.CASH)
                .amount(booking.getTotalPrice())
                .currency("VND")
                .status(PaymentStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();
        return toResponse(paymentRepository.save(payment));
    }

    /** Kept for the legacy /payments/vnpay/create endpoint. */
    public PaymentResponse createVNPayPayment(String userEmail, String bookingId,
                                               String ipAddr, String bankCode,
                                               String locale) {
        return createPayment(userEmail,
                new PaymentCreateRequest(bookingId, PaymentMethod.VNPAY, bankCode, locale),
                ipAddr);
    }

    // ── callback (return URL + IPN) ───────────────────────────────────────────

    /**
     * Verifies the VNPay signature and updates Payment + Booking state.
     * Safe to call multiple times — skips processing if already finalised.
     *
     * @param rawParams raw query params received from VNPay (will be mutated internally)
     * @return IPN response map  {"RspCode":"00","Message":"Confirm Success"} on success
     */
    public Map<String, String> processCallback(Map<String, String> rawParams) {
        // Work on a copy so the controller still has the originals
        Map<String, String> params = new HashMap<>(rawParams);

        if (!vnPayService.verifySignature(params))
            return ipnError("97", "Invalid signature");

        String txnRef      = params.get("vnp_TxnRef");
        String responseCode = params.get("vnp_ResponseCode");
        String transactionNo = params.get("vnp_TransactionNo");
        long   paidAmount  = Long.parseLong(params.get("vnp_Amount")) / 100;

        Payment payment = paymentRepository.findById(txnRef).orElse(null);
        if (payment == null) return ipnError("01", "Order not found");

        // Idempotency — already finalised
        if (payment.getStatus() == PaymentStatus.PAID
                || payment.getStatus() == PaymentStatus.FAILED)
            return ipnError("02", "Order already confirmed");

        // Amount tamper check
        if (payment.getAmount().longValue() != paidAmount)
            return ipnError("04", "Invalid amount");

        if (transactionNo != null && !transactionNo.isBlank())
            payment.setTransactionId(transactionNo);

        payment.setGatewayResponse(new TreeMap<>(params).toString());

        if ("00".equals(responseCode)) {
            payment.setStatus(PaymentStatus.PAID);
            payment.setPaidAt(LocalDateTime.now());
            updateBookingPaymentStatus(payment.getBookingId(), PaymentStatus.PAID);
            paymentRepository.save(payment);
            emitPaymentEvent(payment, "PAYMENT_SUCCESS");
        } else {
            payment.setStatus(PaymentStatus.FAILED);
            paymentRepository.save(payment);
            emitPaymentEvent(payment, "PAYMENT_FAILED");
        }

        return Map.of("RspCode", "00", "Message", "Confirm Success");
    }

    // ── refund ────────────────────────────────────────────────────────────────

    public PaymentResponse refundPayment(String paymentId, String requesterEmail,
                                          String reason, String ipAddr) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));

        if (payment.getStatus() != PaymentStatus.PAID)
            throw new AppException(ErrorCode.PAYMENT_REFUND_NOT_ALLOWED);

        if (payment.getMethod() != PaymentMethod.VNPAY || payment.getTransactionId() == null)
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);

        String transactionDate = payment.getCreatedAt()
                .format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String orderInfo = (reason != null && !reason.isBlank())
                ? reason : "Hoan tien booking #" + payment.getBookingId();

        Map<String, Object> response = vnPayService.callRefundApi(
                payment.getId(),
                payment.getAmount().longValue(),
                payment.getTransactionId(),
                transactionDate,
                requesterEmail,
                ipAddr,
                orderInfo);

        String responseCode = String.valueOf(response.getOrDefault("vnp_ResponseCode", ""));
        if (!"00".equals(responseCode))
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_ERROR);

        payment.setStatus(PaymentStatus.REFUNDED);
        payment.setRefundedAt(LocalDateTime.now());
        payment.setRefundReason(reason);
        payment.setGatewayResponse(response.toString());
        paymentRepository.save(payment);

        updateBookingPaymentStatus(payment.getBookingId(), PaymentStatus.REFUNDED);

        return toResponse(payment);
    }

    // ── query ─────────────────────────────────────────────────────────────────

    public PaymentResponse getById(String paymentId, boolean includeGatewayDetails) {
        Payment p = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        return includeGatewayDetails ? toDetailResponse(p) : toResponse(p);
    }

    public List<PaymentResponse> getByBookingId(String bookingId) {
        return paymentRepository.findByBookingIdOrderByCreatedAtDesc(bookingId)
                .stream().map(this::toResponse).toList();
    }

    public PageResponse<PaymentResponse> getMyPayments(String userEmail,
                                                        PaymentStatus status,
                                                        int page, int size) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Payment> result = status != null
                ? paymentRepository.findByUserIdAndStatus(user.getId(), status, pageable)
                : paymentRepository.findByUserId(user.getId(), pageable);

        // Auto-fix stale PENDING payments whose booking is already cancelled/rejected
        result.getContent().forEach(p -> {
            if (p.getStatus() == PaymentStatus.PENDING) {
                bookingRepository.findById(p.getBookingId()).ifPresent(b -> {
                    if (b.getStatus() == BookingStatus.CANCELLED
                            || b.getStatus() == BookingStatus.REJECTED) {
                        p.setStatus(PaymentStatus.CANCELLED);
                        paymentRepository.save(p);
                    }
                });
            }
        });

        return PageResponse.<PaymentResponse>builder()
                .content(result.getContent().stream().map(this::toResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private void emitPaymentEvent(Payment payment, String eventType) {
        Booking booking = bookingRepository.findById(payment.getBookingId()).orElse(null);
        User    user    = userRepository.findById(payment.getUserId()).orElse(null);
        if (booking == null || user == null) return;

        PaymentNotification notification = PaymentNotification.builder()
                .eventType(eventType)
                .paymentId(payment.getId())
                .bookingId(payment.getBookingId())
                .hotelId(booking.getHotelId())
                .method(payment.getMethod())
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .status(payment.getStatus())
                .transactionId(payment.getTransactionId())
                .paidAt(payment.getPaidAt())
                .build();

        // User: update payment UI in real time
        messagingTemplate.convertAndSendToUser(
                user.getEmail(), "/queue/notifications", notification);

        // Hotel staff / owner: see incoming payment on their dashboard
        messagingTemplate.convertAndSend(
                "/topic/hotel/" + booking.getHotelId(), notification);

        // Send confirmation email only on successful payment
        if ("PAYMENT_SUCCESS".equals(eventType)) {
            var hotel = hotelRepository.findById(booking.getHotelId()).orElse(null);
            var room  = roomRepository.findById(booking.getRoomId()).orElse(null);
            emailService.sendPaymentConfirmEmail(user, booking, room, hotel, payment);
        }
    }

    private void updateBookingPaymentStatus(String bookingId, PaymentStatus status) {
        bookingRepository.findById(bookingId).ifPresent(b -> {
            b.setPaymentStatus(status);
            bookingRepository.save(b);
        });
    }

    private Map<String, String> ipnError(String code, String message) {
        return Map.of("RspCode", code, "Message", message);
    }

    private PaymentResponse toResponse(Payment p) {
        return PaymentResponse.builder()
                .paymentId(p.getId())
                .bookingId(p.getBookingId())
                .userId(p.getUserId())
                .method(p.getMethod())
                .amount(p.getAmount())
                .currency(p.getCurrency())
                .status(p.getStatus())
                .paymentUrl(p.getPaymentUrl())
                .transactionId(p.getTransactionId())
                .createdAt(p.getCreatedAt())
                .paidAt(p.getPaidAt())
                .refundedAt(p.getRefundedAt())
                .refundReason(p.getRefundReason())
                .build();
    }

    private PaymentResponse toDetailResponse(Payment p) {
        return PaymentResponse.builder()
                .paymentId(p.getId())
                .bookingId(p.getBookingId())
                .userId(p.getUserId())
                .method(p.getMethod())
                .amount(p.getAmount())
                .currency(p.getCurrency())
                .status(p.getStatus())
                .paymentUrl(p.getPaymentUrl())
                .transactionId(p.getTransactionId())
                .createdAt(p.getCreatedAt())
                .paidAt(p.getPaidAt())
                .refundedAt(p.getRefundedAt())
                .refundReason(p.getRefundReason())
                .gatewayResponse(p.getGatewayResponse())
                .build();
    }
}
