package com.example.Back_End.service;

import com.example.Back_End.dto.request.BookingRequest;
import com.example.Back_End.dto.request.ReasonRequest;
import com.example.Back_End.dto.request.ValidateDiscountRequest;
import com.example.Back_End.dto.response.ValidateDiscountResponse;
import com.example.Back_End.dto.response.BookingNotification;
import com.example.Back_End.dto.response.BookingResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.RoomStatus;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.model.Payment;
import com.example.Back_End.model.enums.PaymentStatus;
import com.example.Back_End.dto.response.PaymentNotification;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.PaymentRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

// Các trạng thái không chiếm chỗ (không gây xung đột lịch)
// newStart < existEnd AND newEnd > existStart AND status NOT IN this list → conflict


@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository     bookingRepository;
    private final PaymentRepository     paymentRepository;
    private final RoomRepository        roomRepository;
    private final HotelRepository       hotelRepository;
    private final UserRepository        userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final MongoTemplate         mongoTemplate;
    private final NotificationService   notificationService;
    private final EmailService          emailService;
    private final DiscountService       discountService;
    private final MessageService        messageService;

    @Value("${booking.cancel.min-days-before:1}")
    private int cancelMinDaysBefore;

    @Caching(evict = {
        // Room availability caches
        @CacheEvict(value = "rooms:available",    allEntries = true),
        @CacheEvict(value = "rooms:booked-dates", allEntries = true),
        // Recommendations: user preference changed after new booking
        @CacheEvict(value = "rec:hybrid",         key = "#userEmail"),
        @CacheEvict(value = "rec:cbf",            key = "#userEmail"),
        @CacheEvict(value = "rec:cf",             key = "#userEmail"),
        // Analytics: new booking affects all hotel-level metrics
        @CacheEvict(value = "analytics:overview",       allEntries = true),
        @CacheEvict(value = "analytics:revenue",        allEntries = true),
        @CacheEvict(value = "analytics:booking-status", allEntries = true),
        @CacheEvict(value = "analytics:top-rooms",      allEntries = true),
        @CacheEvict(value = "analytics:discounts",      allEntries = true),
        @CacheEvict(value = "analytics:price",          allEntries = true),
        @CacheEvict(value = "analytics:forecast",       allEntries = true),
    })
    public BookingResponse createBooking(String userEmail, BookingRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new AppException(ErrorCode.ROOM_NOT_FOUND));

        if (room.getStatus() != RoomStatus.AVAILABLE) {
            throw new AppException(ErrorCode.ROOM_NOT_AVAILABLE);
        }

        LocalDate today = LocalDate.now();
        if (!request.getCheckIn().isBefore(request.getCheckOut())) {
            throw new AppException(ErrorCode.INVALID_DATE_RANGE);
        }
        if (request.getCheckIn().isBefore(today)) {
            throw new AppException(ErrorCode.INVALID_DATE_RANGE);
        }

        List<BookingStatus> nonBlocking = List.of(BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.CHECKED_OUT);
        boolean conflict = bookingRepository
                .existsByRoomIdAndStatusNotInAndCheckInLessThanAndCheckOutGreaterThan(
                        room.getId(), nonBlocking,
                        request.getCheckOut(), request.getCheckIn());
        if (conflict) {
            throw new AppException(ErrorCode.BOOKING_CONFLICT);
        }

        Hotel hotel = hotelRepository.findById(room.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        long nights = ChronoUnit.DAYS.between(request.getCheckIn(), request.getCheckOut());
        double originalPrice = BigDecimal.valueOf(nights)
                .multiply(BigDecimal.valueOf(room.getPricePerNight()))
                .setScale(0, RoundingMode.HALF_UP)
                .doubleValue();

        double discountAmount = 0;
        String discountId     = null;
        if (request.getDiscountCode() != null && !request.getDiscountCode().isBlank()) {
            ValidateDiscountRequest vReq = new ValidateDiscountRequest();
            vReq.setCode(request.getDiscountCode());
            vReq.setHotelId(hotel.getId());
            vReq.setOrderAmount(originalPrice);
            ValidateDiscountResponse vRes = discountService.validate(vReq);
            discountAmount = vRes.getDiscountAmount();
            discountId     = vRes.getDiscountId();
        }
        double totalPrice = BigDecimal.valueOf(originalPrice - discountAmount)
                .setScale(0, RoundingMode.HALF_UP)
                .doubleValue();

        Booking booking = Booking.builder()
                .roomId(room.getId())
                .hotelId(hotel.getId())
                .userId(user.getId())
                .discountId(discountId)
                .checkIn(request.getCheckIn())
                .checkOut(request.getCheckOut())
                .guestCount(request.getGuestCount())
                .originalPrice(originalPrice)
                .discountAmount(discountAmount)
                .totalPrice(totalPrice)
                .specialRequests(request.getSpecialRequests())
                .status(BookingStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        Booking saved = bookingRepository.save(booking);
        if (discountId != null) {
            discountService.incrementUsedCount(discountId);
        }

        BookingNotification notification = BookingNotification.builder()
                .eventType("BOOKING_CREATED")
                .bookingId(saved.getId())
                .hotelId(saved.getHotelId())
                .roomId(saved.getRoomId())
                .roomNumber(room.getRoomNumber())
                .checkIn(saved.getCheckIn())
                .checkOut(saved.getCheckOut())
                .guestCount(saved.getGuestCount())
                .totalPrice(saved.getTotalPrice())
                .status(saved.getStatus())
                .createdAt(saved.getCreatedAt())
                .build();
        messagingTemplate.convertAndSend("/topic/hotel/" + hotel.getId(), notification);
        notificationService.saveForHotel(notification, hotel.getId());

        return toResponse(saved, room, hotel);
    }

    public BookingResponse getBookingById(String bookingId, String actorEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (actor.getRole() == UserRole.STAFF) {
            if (!booking.getHotelId().equals(actor.getHotelId()))
                throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        } else if (actor.getRole() == UserRole.OWNER) {
            Hotel hotel = hotelRepository.findById(booking.getHotelId())
                    .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));
            if (!hotel.getOwnerId().equals(actor.getId()))
                throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        } else if (actor.getRole() == UserRole.USER) {
            if (!booking.getUserId().equals(actor.getId()))
                throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        } else {
            throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        }

        Room  room  = roomRepository.findById(booking.getRoomId()).orElse(null);
        Hotel hotel = hotelRepository.findById(booking.getHotelId()).orElse(null);
        User  guest = userRepository.findById(booking.getUserId()).orElse(null);
        return toResponseWithGuest(booking, room, hotel, guest);
    }

    @Caching(evict = {
        @CacheEvict(value = "analytics:overview",       allEntries = true),
        @CacheEvict(value = "analytics:booking-status", allEntries = true),
    })
    public BookingResponse confirmBooking(String bookingId, String actorEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new AppException(ErrorCode.BOOKING_INVALID_STATUS);
        }

        Hotel hotel = hotelRepository.findById(booking.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyHotelAccess(hotel, actorEmail);

        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setConfirmedAt(LocalDateTime.now());

        Booking saved = bookingRepository.save(booking);
        Room room = roomRepository.findById(saved.getRoomId()).orElse(null);

        BookingNotification confirmedNotif = BookingNotification.builder()
                .eventType("BOOKING_CONFIRMED")
                .bookingId(saved.getId())
                .hotelId(saved.getHotelId())
                .roomId(saved.getRoomId())
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .checkIn(saved.getCheckIn())
                .checkOut(saved.getCheckOut())
                .guestCount(saved.getGuestCount())
                .totalPrice(saved.getTotalPrice())
                .status(saved.getStatus())
                .createdAt(saved.getCreatedAt())
                .build();
        userRepository.findById(saved.getUserId()).ifPresent(bookingUser -> {
            messagingTemplate.convertAndSendToUser(
                    bookingUser.getEmail(), "/queue/notifications", confirmedNotif);
            emailService.sendBookingConfirmedEmail(bookingUser, saved, room, hotel);
        });
        notificationService.saveForUser(confirmedNotif, saved.getUserId());

        messageService.createSystemMessage(saved.getUserId(), saved.getHotelId(),
                "✅ Đặt phòng #" + saved.getId().substring(0, 8).toUpperCase()
                + " đã được xác nhận. Nhận phòng: " + saved.getCheckIn()
                + " → " + saved.getCheckOut());

        return toResponse(saved, room, hotel);
    }

    public PageResponse<BookingResponse> getMyBookings(
            String userEmail, BookingStatus status, int page, int size) {

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<Booking> bookingPage = (status != null)
                ? bookingRepository.findByUserIdAndStatusOrderByCreatedAtDesc(user.getId(), status, pageable)
                : bookingRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), pageable);

        List<BookingResponse> content = bookingPage.getContent().stream()
                .map(b -> {
                    Room  room  = roomRepository.findById(b.getRoomId()).orElse(null);
                    Hotel hotel = hotelRepository.findById(b.getHotelId()).orElse(null);
                    return toResponse(b, room, hotel);
                })
                .toList();

        return PageResponse.<BookingResponse>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(bookingPage.getTotalElements())
                .totalPages(bookingPage.getTotalPages())
                .build();
    }

    public BookingResponse markAsPaid(String bookingId, String userEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!booking.getUserId().equals(user.getId()))
            throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);

        if (booking.getPaymentStatus() == com.example.Back_End.model.enums.PaymentStatus.PAID)
            throw new AppException(ErrorCode.BOOKING_INVALID_STATUS);

        booking.setPaymentStatus(com.example.Back_End.model.enums.PaymentStatus.PAID);
        Booking saved = bookingRepository.save(booking);

        Room  room  = roomRepository.findById(saved.getRoomId()).orElse(null);
        Hotel hotel = hotelRepository.findById(saved.getHotelId()).orElse(null);

        BookingNotification payNotif = BookingNotification.builder()
                .eventType("BOOKING_PAID")
                .bookingId(saved.getId())
                .hotelId(saved.getHotelId())
                .roomId(saved.getRoomId())
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .checkIn(saved.getCheckIn()).checkOut(saved.getCheckOut())
                .guestCount(saved.getGuestCount()).totalPrice(saved.getTotalPrice())
                .status(saved.getStatus()).createdAt(saved.getCreatedAt())
                .build();

        // Thông báo cho staff/owner của khách sạn
        if (hotel != null) {
            messagingTemplate.convertAndSend("/topic/hotel/" + hotel.getId(), payNotif);
            notificationService.saveForHotel(payNotif, hotel.getId());
        }

        // Thông báo cho user
        messagingTemplate.convertAndSendToUser(user.getEmail(), "/queue/notifications", payNotif);
        notificationService.saveForUser(payNotif, user.getId());

        emailService.sendPaymentConfirmEmail(user, saved, room, hotel);

        return toResponse(saved, room, hotel);
    }

    @Caching(evict = {
        @CacheEvict(value = "rooms:available",          allEntries = true),
        @CacheEvict(value = "rooms:booked-dates",       allEntries = true),
        @CacheEvict(value = "analytics:overview",       allEntries = true),
        @CacheEvict(value = "analytics:booking-status", allEntries = true),
        @CacheEvict(value = "analytics:top-rooms",      allEntries = true),
        @CacheEvict(value = "analytics:forecast",       allEntries = true),
        @CacheEvict(value = "analytics:price",          allEntries = true),
    })
    public BookingResponse cancelBooking(String bookingId, String userEmail, ReasonRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUserId().equals(user.getId())) {
            throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        }

        if (booking.getStatus() != BookingStatus.PENDING
                && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new AppException(ErrorCode.BOOKING_INVALID_STATUS);
        }

        if (!LocalDate.now().plusDays(cancelMinDaysBefore).isBefore(booking.getCheckIn())) {
            throw new AppException(ErrorCode.BOOKING_CANCEL_TOO_LATE);
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelReason(request.getReason());

        Booking saved = bookingRepository.save(booking);
        Hotel hotel = hotelRepository.findById(saved.getHotelId()).orElse(null);
        Room  room  = roomRepository.findById(saved.getRoomId()).orElse(null);

        // Cancel all pending payments for this booking and notify user in real-time
        List<Payment> pendingPayments = paymentRepository
                .findAllByBookingIdAndStatus(saved.getId(), PaymentStatus.PENDING);
        for (Payment p : pendingPayments) {
            p.setStatus(PaymentStatus.CANCELLED);
            paymentRepository.save(p);
            PaymentNotification pn = PaymentNotification.builder()
                    .eventType("PAYMENT_FAILED")
                    .paymentId(p.getId())
                    .bookingId(p.getBookingId())
                    .method(p.getMethod())
                    .amount(p.getAmount())
                    .currency(p.getCurrency())
                    .status(PaymentStatus.CANCELLED)
                    .build();
            messagingTemplate.convertAndSendToUser(user.getEmail(), "/queue/notifications", pn);
        }

        BookingNotification cancelledNotif = BookingNotification.builder()
                .eventType("BOOKING_CANCELLED")
                .bookingId(saved.getId())
                .hotelId(saved.getHotelId())
                .roomId(saved.getRoomId())
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .checkIn(saved.getCheckIn())
                .checkOut(saved.getCheckOut())
                .guestCount(saved.getGuestCount())
                .totalPrice(saved.getTotalPrice())
                .status(saved.getStatus())
                .cancelReason(saved.getCancelReason())
                .createdAt(saved.getCreatedAt())
                .build();

        // Notify hotel (OWNER / STAFF)
        if (hotel != null) {
            messagingTemplate.convertAndSend("/topic/hotel/" + hotel.getId(), cancelledNotif);
            notificationService.saveForHotel(cancelledNotif, hotel.getId());
        }

        // Notify the user who cancelled (sync other tabs / notification history)
        userRepository.findById(saved.getUserId()).ifPresent(bookingUser -> {
            messagingTemplate.convertAndSendToUser(
                    bookingUser.getEmail(), "/queue/notifications", cancelledNotif);
            notificationService.saveForUser(cancelledNotif, saved.getUserId());
        });

        return toResponse(saved, room, hotel);
    }

    @Caching(evict = {
        @CacheEvict(value = "rooms:booked-dates",       allEntries = true),
        @CacheEvict(value = "analytics:overview",       allEntries = true),
        @CacheEvict(value = "analytics:booking-status", allEntries = true),
        @CacheEvict(value = "analytics:forecast",       allEntries = true),
        @CacheEvict(value = "analytics:price",          allEntries = true),
    })
    public BookingResponse rejectBooking(String bookingId, String actorEmail, ReasonRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new AppException(ErrorCode.BOOKING_INVALID_STATUS);
        }

        Hotel hotel = hotelRepository.findById(booking.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyHotelAccess(hotel, actorEmail);

        booking.setStatus(BookingStatus.REJECTED);
        booking.setCancelReason(request.getReason());

        Booking saved = bookingRepository.save(booking);
        Room room = roomRepository.findById(saved.getRoomId()).orElse(null);

        BookingNotification rejectedNotif = BookingNotification.builder()
                .eventType("BOOKING_REJECTED")
                .bookingId(saved.getId())
                .hotelId(saved.getHotelId())
                .roomId(saved.getRoomId())
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .checkIn(saved.getCheckIn())
                .checkOut(saved.getCheckOut())
                .guestCount(saved.getGuestCount())
                .totalPrice(saved.getTotalPrice())
                .status(saved.getStatus())
                .cancelReason(saved.getCancelReason())
                .createdAt(saved.getCreatedAt())
                .build();
        userRepository.findById(saved.getUserId()).ifPresent(bookingUser ->
                messagingTemplate.convertAndSendToUser(
                        bookingUser.getEmail(), "/queue/notifications", rejectedNotif));
        notificationService.saveForUser(rejectedNotif, saved.getUserId());

        return toResponse(saved, room, hotel);
    }

    @Caching(evict = {
        @CacheEvict(value = "analytics:overview",       allEntries = true),
        @CacheEvict(value = "analytics:booking-status", allEntries = true),
    })
    public BookingResponse checkIn(String bookingId, String staffEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new AppException(ErrorCode.BOOKING_INVALID_STATUS);
        }

        Hotel hotel = hotelRepository.findById(booking.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyStaffAccess(hotel, staffEmail);

        booking.setStatus(BookingStatus.CHECKED_IN);

        Booking saved = bookingRepository.save(booking);
        Room room = roomRepository.findById(saved.getRoomId()).orElse(null);

        BookingNotification checkInNotif = BookingNotification.builder()
                .eventType("BOOKING_CHECKED_IN")
                .bookingId(saved.getId())
                .hotelId(saved.getHotelId())
                .roomId(saved.getRoomId())
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .checkIn(saved.getCheckIn())
                .checkOut(saved.getCheckOut())
                .guestCount(saved.getGuestCount())
                .totalPrice(saved.getTotalPrice())
                .status(saved.getStatus())
                .createdAt(saved.getCreatedAt())
                .build();
        messagingTemplate.convertAndSend("/topic/hotel/" + hotel.getId(), checkInNotif);
        notificationService.saveForHotel(checkInNotif, hotel.getId());

        userRepository.findById(saved.getUserId()).ifPresent(guest ->
                messagingTemplate.convertAndSendToUser(guest.getEmail(), "/queue/notifications", checkInNotif));
        notificationService.saveForUser(checkInNotif, saved.getUserId());

        messageService.createSystemMessage(saved.getUserId(), saved.getHotelId(),
                "🏠 Bạn đã nhận phòng " + (room != null ? room.getRoomNumber() : "")
                + ". Chúc bạn có kỳ nghỉ tuyệt vời!");

        return toResponse(saved, room, hotel);
    }

    @Caching(evict = {
        @CacheEvict(value = "rooms:available",          allEntries = true),
        @CacheEvict(value = "rooms:booked-dates",       allEntries = true),
        @CacheEvict(value = "analytics:overview",       allEntries = true),
        @CacheEvict(value = "analytics:booking-status", allEntries = true),
        @CacheEvict(value = "analytics:revenue",        allEntries = true),
    })
    public BookingResponse checkOut(String bookingId, String staffEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (booking.getStatus() != BookingStatus.CHECKED_IN) {
            throw new AppException(ErrorCode.BOOKING_INVALID_STATUS);
        }

        Hotel hotel = hotelRepository.findById(booking.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyStaffAccess(hotel, staffEmail);

        booking.setStatus(BookingStatus.CHECKED_OUT);

        Booking saved = bookingRepository.save(booking);
        Room room = roomRepository.findById(saved.getRoomId()).orElse(null);

        BookingNotification checkOutNotif = BookingNotification.builder()
                .eventType("BOOKING_CHECKED_OUT")
                .bookingId(saved.getId())
                .hotelId(saved.getHotelId())
                .roomId(saved.getRoomId())
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .checkIn(saved.getCheckIn())
                .checkOut(saved.getCheckOut())
                .guestCount(saved.getGuestCount())
                .totalPrice(saved.getTotalPrice())
                .status(saved.getStatus())
                .createdAt(saved.getCreatedAt())
                .build();
        messagingTemplate.convertAndSend("/topic/hotel/" + hotel.getId(), checkOutNotif);
        notificationService.saveForHotel(checkOutNotif, hotel.getId());

        userRepository.findById(saved.getUserId()).ifPresent(guest -> {
            messagingTemplate.convertAndSendToUser(guest.getEmail(), "/queue/notifications", checkOutNotif);
            emailService.sendCheckOutReviewEmail(guest, saved, room, hotel);
        });

        messageService.createSystemMessage(saved.getUserId(), saved.getHotelId(),
                "🧳 Bạn đã trả phòng thành công. Cảm ơn đã lưu trú tại "
                + hotel.getName() + "! Email đánh giá đã được gửi.");
        notificationService.saveForUser(checkOutNotif, saved.getUserId());

        return toResponse(saved, room, hotel);
    }

    public PageResponse<BookingResponse> getBookingsByHotel(
            String hotelId, String actorEmail,
            BookingStatus status, LocalDate checkIn, LocalDate checkOut,
            int page, int size) {

        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        verifyHotelAccess(hotel, actorEmail);

        Criteria criteria = Criteria.where("hotelId").is(hotelId);
        if (status  != null) criteria = criteria.and("status").is(status);
        if (checkIn != null) criteria = criteria.and("checkIn").gte(checkIn);
        if (checkOut != null) criteria = criteria.and("checkOut").lte(checkOut);

        Query countQuery = Query.query(criteria);
        long total = mongoTemplate.count(countQuery, Booking.class);

        Query dataQuery = Query.query(criteria)
                .with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<BookingResponse> content = mongoTemplate.find(dataQuery, Booking.class)
                .stream()
                .map(b -> {
                    Room r = roomRepository.findById(b.getRoomId()).orElse(null);
                    return toResponse(b, r, hotel);
                })
                .toList();

        return PageResponse.<BookingResponse>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages((int) Math.ceil((double) total / size))
                .build();
    }

    private void verifyStaffAccess(Hotel hotel, String actorEmail) {
        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        boolean isStaff = actor.getRole() == UserRole.STAFF
                && hotel.getId().equals(actor.getHotelId());
        boolean isOwner = actor.getRole() == UserRole.OWNER
                && hotel.getOwnerId().equals(actor.getId());

        if (!isStaff && !isOwner) {
            throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        }
    }

    private void verifyHotelAccess(Hotel hotel, String actorEmail) {
        User actor = userRepository.findByEmail(actorEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        boolean isOwner = hotel.getOwnerId().equals(actor.getId());
        boolean isStaff = actor.getRole() == UserRole.STAFF
                && hotel.getId().equals(actor.getHotelId());

        if (!isOwner && !isStaff) {
            throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
        }
    }

    private BookingResponse toResponse(Booking b, Room room, Hotel hotel) {
        return BookingResponse.builder()
                .id(b.getId())
                .userId(b.getUserId())
                .roomId(b.getRoomId())
                .hotelId(b.getHotelId())
                .discountId(b.getDiscountId())
                .checkIn(b.getCheckIn())
                .checkOut(b.getCheckOut())
                .guestCount(b.getGuestCount())
                .originalPrice(b.getOriginalPrice())
                .discountAmount(b.getDiscountAmount())
                .totalPrice(b.getTotalPrice())
                .status(b.getStatus())
                .paymentStatus(b.getPaymentStatus())
                .specialRequests(b.getSpecialRequests())
                .cancelReason(b.getCancelReason())
                .confirmedAt(b.getConfirmedAt())
                .createdAt(b.getCreatedAt())
                .hotelName(hotel != null ? hotel.getName() : null)
                .hotelAddress(hotel != null ? hotel.getAddress() : null)
                .hotelCity(hotel != null ? hotel.getCity() : null)
                .roomNumber(room != null ? room.getRoomNumber() : null)
                .roomType(room != null ? room.getType() : null)
                .pricePerNight(room != null ? room.getPricePerNight() : null)
                .build();
    }

    private BookingResponse toResponseWithGuest(Booking b, Room room, Hotel hotel, User guest) {
        return toResponse(b, room, hotel).toBuilder()
                .guestName(guest != null ? guest.getFullName() : null)
                .guestEmail(guest != null ? guest.getEmail() : null)
                .build();
    }
}
