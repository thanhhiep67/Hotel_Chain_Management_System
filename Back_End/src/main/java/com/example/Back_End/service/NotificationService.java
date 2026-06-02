package com.example.Back_End.service;

import com.example.Back_End.dto.response.BookingNotification;
import com.example.Back_End.dto.response.NotificationResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Notification;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.NotificationRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository         userRepository;
    private final HotelRepository        hotelRepository;
    private final MongoTemplate          mongoTemplate;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /* ── Save ── */

    public void saveForUser(BookingNotification event, String recipientUserId) {
        notificationRepository.save(build(event, recipientUserId, true));
    }

    public void saveForHotel(BookingNotification event, String recipientHotelId) {
        notificationRepository.save(build(event, recipientHotelId, false));
    }

    /* ── Query ── */

    public PageResponse<NotificationResponse> getMyNotifications(
            String actorEmail, Boolean isRead, int page, int size) {

        User user = resolve(actorEmail);
        Pageable pageable = PageRequest.of(page, size);

        Page<Notification> result;
        if (user.getRole() == UserRole.USER) {
            result = isRead != null
                    ? notificationRepository.findByRecipientIdAndIsReadOrderByCreatedAtDesc(user.getId(), isRead, pageable)
                    : notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId(), pageable);
        } else {
            List<String> ids = resolveHotelIds(user);
            if (ids.isEmpty()) {
                return PageResponse.<NotificationResponse>builder()
                        .content(List.of()).page(page).size(size)
                        .totalElements(0).totalPages(0).build();
            }
            result = isRead != null
                    ? notificationRepository.findByRecipientIdInAndIsReadOrderByCreatedAtDesc(ids, isRead, pageable)
                    : notificationRepository.findByRecipientIdInOrderByCreatedAtDesc(ids, pageable);
        }

        return PageResponse.<NotificationResponse>builder()
                .content(result.getContent().stream().map(this::toResponse).toList())
                .page(page)
                .size(size)
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    /* ── Mark all read ── */

    public void markAllRead(String actorEmail) {
        User user = resolve(actorEmail);
        Criteria criteria = buildCriteria(user);
        if (criteria == null) return;

        mongoTemplate.updateMulti(
                Query.query(criteria.and("isRead").is(false)),
                Update.update("isRead", true),
                Notification.class);
    }

    /* ── Clear all ── */

    public void clearAll(String actorEmail) {
        User user = resolve(actorEmail);

        if (user.getRole() == UserRole.USER) {
            notificationRepository.deleteByRecipientId(user.getId());
        } else {
            List<String> ids = resolveHotelIds(user);
            if (!ids.isEmpty()) notificationRepository.deleteByRecipientIdIn(ids);
        }
    }

    /* ── Helpers ── */

    private Notification build(BookingNotification e, String recipientId, boolean forUser) {
        return Notification.builder()
                .recipientId(recipientId)
                .type(e.getEventType())
                .title(buildTitle(e.getEventType(), forUser))
                .message(buildMessage(e))
                .referenceId(e.getBookingId())
                .referenceType("BOOKING")
                .hotelId(e.getHotelId())
                .createdAt(LocalDateTime.now())
                .build();
    }

    private String buildTitle(String eventType, boolean forUser) {
        return switch (eventType) {
            case "BOOKING_CREATED"    -> "Booking mới";
            case "BOOKING_CONFIRMED"  -> "Đặt phòng được xác nhận";
            case "BOOKING_REJECTED"   -> "Đặt phòng bị từ chối";
            case "BOOKING_CANCELLED"  -> forUser ? "Đặt phòng đã hủy" : "Khách hủy đặt phòng";
            case "BOOKING_CHECKED_IN" -> "Khách đã nhận phòng";
            case "BOOKING_CHECKED_OUT"-> "Khách đã trả phòng";
            case "BOOKING_PAID"       -> forUser ? "Thanh toán thành công" : "Khách đã thanh toán";
            default -> "Thông báo";
        };
    }

    private String buildMessage(BookingNotification e) {
        String room    = e.getRoomNumber() != null ? "Phòng " + e.getRoomNumber() : "—";
        String checkIn = e.getCheckIn()  != null ? e.getCheckIn().format(DATE_FMT)  : "—";
        String checkOut= e.getCheckOut() != null ? e.getCheckOut().format(DATE_FMT) : "—";

        StringBuilder sb = new StringBuilder(room)
                .append(", ").append(checkIn).append(" → ").append(checkOut);

        if (e.getGuestCount() != null) {
            sb.append(", ").append(e.getGuestCount()).append(" khách");
        }
        if (e.getCancelReason() != null && !e.getCancelReason().isBlank()) {
            sb.append(". Lý do: ").append(e.getCancelReason());
        }
        return sb.toString();
    }

    private Criteria buildCriteria(User user) {
        if (user.getRole() == UserRole.USER) {
            return Criteria.where("recipientId").is(user.getId());
        }
        List<String> ids = resolveHotelIds(user);
        return ids.isEmpty() ? null : Criteria.where("recipientId").in(ids);
    }

    private User resolve(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private List<String> resolveHotelIds(User user) {
        if (user.getRole() == UserRole.STAFF) {
            return user.getHotelId() != null ? List.of(user.getHotelId()) : List.of();
        }
        return hotelRepository.findByOwnerId(user.getId())
                .stream().map(h -> h.getId()).toList();
    }

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .referenceId(n.getReferenceId())
                .referenceType(n.getReferenceType())
                .hotelId(n.getHotelId())
                .isRead(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
