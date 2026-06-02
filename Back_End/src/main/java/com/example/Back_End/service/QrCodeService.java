package com.example.Back_End.service;

import com.example.Back_End.dto.response.BookingResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import com.example.Back_End.util.QrCodeUtil;
import io.jsonwebtoken.io.Decoders;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class QrCodeService {

    // ── Config ────────────────────────────────────────────────────────────────

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${qr.checkin.expiry-minutes:15}")
    private int expiryMinutes;

    @Value("${qr.checkin.size-px:350}")
    private int sizePx;

    // ── Repos ─────────────────────────────────────────────────────────────────

    private final BookingRepository bookingRepository;
    private final UserRepository    userRepository;
    private final RoomRepository    roomRepository;
    private final HotelRepository   hotelRepository;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Generate a time-limited QR PNG for check-in.
     * Only the booking owner (USER) may request it.
     * The image is never stored — returned directly as bytes.
     *
     * Payload format:  {bookingId}|{expiryEpochSec}|{hmacBase64url}
     * HMAC input:      "{bookingId}:{expiryEpochSec}"  signed with JWT secret
     */
    public byte[] generateCheckInQr(String bookingId, String userEmail) {
        User user    = resolveUser(userEmail);
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUserId().equals(user.getId())) {
            throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        }

        long exp     = Instant.now().plusSeconds((long) expiryMinutes * 60).getEpochSecond();
        String payload = buildPayload(bookingId, exp);
        return QrCodeUtil.generatePng(payload, sizePx);
    }

    /**
     * Verify a scanned QR payload and return the corresponding booking.
     * Accessible by STAFF (own hotel only) and OWNER (own hotels only).
     */
    public BookingResponse scanQr(String payload, String actorEmail) {
        // ── 1. Parse ──────────────────────────────────────────────────────────
        String[] parts = payload.split("\\|", 3);
        if (parts.length != 3) throw new AppException(ErrorCode.QR_INVALID);

        String bookingId = parts[0];
        long   exp;
        try {
            exp = Long.parseLong(parts[1]);
        } catch (NumberFormatException e) {
            throw new AppException(ErrorCode.QR_INVALID);
        }
        String providedHmac = parts[2];

        // ── 2. Expiry ─────────────────────────────────────────────────────────
        if (Instant.now().getEpochSecond() > exp) {
            throw new AppException(ErrorCode.QR_INVALID);
        }

        // ── 3. HMAC — constant-time comparison prevents timing attacks ────────
        String expectedHmac = hmacSha256(bookingId + ":" + exp);
        if (!MessageDigest.isEqual(
                providedHmac.getBytes(StandardCharsets.UTF_8),
                expectedHmac.getBytes(StandardCharsets.UTF_8))) {
            throw new AppException(ErrorCode.QR_INVALID);
        }

        // ── 4. Booking + access control ───────────────────────────────────────
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User actor = resolveUser(actorEmail);
        verifyHotelAccess(actor, booking.getHotelId());

        return toResponse(booking);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Assemble the signed payload string. */
    private String buildPayload(String bookingId, long exp) {
        String hmac = hmacSha256(bookingId + ":" + exp);
        return bookingId + "|" + exp + "|" + hmac;
    }

    /** HMAC-SHA256 over {@code data} using the JWT secret key bytes. */
    private String hmacSha256(String data) {
        try {
            byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keyBytes, "HmacSHA256"));
            byte[] result = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(result);
        } catch (Exception e) {
            throw new RuntimeException("HMAC computation failed", e);
        }
    }

    /**
     * STAFF → must be assigned to that hotel.
     * OWNER → must own that hotel.
     */
    private void verifyHotelAccess(User actor, String hotelId) {
        if (actor.getRole() == UserRole.STAFF) {
            if (!hotelId.equals(actor.getHotelId())) {
                throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
            }
        } else if (actor.getRole() == UserRole.OWNER) {
            boolean owns = hotelRepository.findById(hotelId)
                    .map(h -> h.getOwnerId().equals(actor.getId()))
                    .orElse(false);
            if (!owns) throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        }
    }

    private BookingResponse toResponse(Booking b) {
        Room  room  = roomRepository.findById(b.getRoomId()).orElse(null);
        Hotel hotel = hotelRepository.findById(b.getHotelId()).orElse(null);

        return BookingResponse.builder()
                .id(b.getId())
                .userId(b.getUserId())
                .roomId(b.getRoomId())
                .hotelId(b.getHotelId())
                .checkIn(b.getCheckIn())
                .checkOut(b.getCheckOut())
                .guestCount(b.getGuestCount())
                .originalPrice(b.getOriginalPrice())
                .discountAmount(b.getDiscountAmount())
                .totalPrice(b.getTotalPrice())
                .status(b.getStatus())
                .paymentStatus(b.getPaymentStatus())
                .specialRequests(b.getSpecialRequests())
                .createdAt(b.getCreatedAt())
                .hotelName(hotel    != null ? hotel.getName()       : null)
                .hotelAddress(hotel != null ? hotel.getAddress()    : null)
                .hotelCity(hotel    != null ? hotel.getCity()       : null)
                .roomNumber(room    != null ? room.getRoomNumber()  : null)
                .roomType(room      != null ? room.getType()        : null)
                .pricePerNight(room != null ? room.getPricePerNight(): null)
                .build();
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }
}
