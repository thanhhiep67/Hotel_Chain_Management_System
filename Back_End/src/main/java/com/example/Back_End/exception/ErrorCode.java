package com.example.Back_End.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "Email already exists"),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User not found"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Invalid email or password"),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "Invalid or expired token"),
    INVALID_OTP(HttpStatus.BAD_REQUEST, "Invalid or expired OTP"),
    HOTEL_NOT_FOUND(HttpStatus.NOT_FOUND, "Hotel not found"),
    HOTEL_NOT_OWNED(HttpStatus.FORBIDDEN, "You do not own this hotel"),
    INVALID_STAFF(HttpStatus.BAD_REQUEST, "User is not a STAFF member"),
    INVALID_STATUS(HttpStatus.BAD_REQUEST, "Status must be ACTIVE or LOCKED"),
    CANNOT_LOCK_ADMIN(HttpStatus.FORBIDDEN, "Cannot change status of an ADMIN account"),
    ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "Room not found"),
    ROOM_NUMBER_DUPLICATE(HttpStatus.CONFLICT, "Room number already exists in this hotel"),
    ROOM_ALREADY_DELETED(HttpStatus.BAD_REQUEST, "Room has already been deleted"),
    INVALID_DATE_RANGE(HttpStatus.BAD_REQUEST, "checkIn must be before checkOut"),
    ROOM_NOT_AVAILABLE(HttpStatus.BAD_REQUEST, "Room is not available for booking"),
    BOOKING_CONFLICT(HttpStatus.CONFLICT, "Room is already booked for the selected dates"),
    BOOKING_NOT_FOUND(HttpStatus.NOT_FOUND, "Booking not found"),
    BOOKING_ACCESS_DENIED(HttpStatus.FORBIDDEN, "You do not have permission to manage this booking"),
    BOOKING_INVALID_STATUS(HttpStatus.BAD_REQUEST, "Booking status does not allow this action"),
    BOOKING_CANCEL_TOO_LATE(HttpStatus.BAD_REQUEST, "Cannot cancel booking within 1 day of check-in"),
    DISCOUNT_NOT_FOUND(HttpStatus.NOT_FOUND, "Discount code not found"),
    DISCOUNT_CODE_EXISTS(HttpStatus.CONFLICT, "Discount code already exists"),
    DISCOUNT_INACTIVE(HttpStatus.BAD_REQUEST, "Discount code is inactive"),
    DISCOUNT_EXPIRED(HttpStatus.BAD_REQUEST, "Discount code has expired"),
    DISCOUNT_USAGE_LIMIT_REACHED(HttpStatus.BAD_REQUEST, "Discount code has reached its usage limit"),
    DISCOUNT_MIN_ORDER_NOT_MET(HttpStatus.BAD_REQUEST, "Order amount does not meet the minimum requirement"),
    DISCOUNT_NOT_APPLICABLE(HttpStatus.BAD_REQUEST, "Discount code is not applicable to this hotel"),
    DISCOUNT_HAS_BEEN_USED(HttpStatus.CONFLICT, "Cannot delete a discount that has already been used"),
    MESSAGE_EMPTY(HttpStatus.BAD_REQUEST, "Message content must not be blank"),
    MESSAGE_NOT_FOUND(HttpStatus.NOT_FOUND, "Message not found"),
    MESSAGE_INVALID_THREAD(HttpStatus.BAD_REQUEST, "Invalid thread ID format"),
    MESSAGE_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Gửi quá nhiều tin nhắn, vui lòng thử lại sau"),
    MESSAGE_INVALID_FILE(HttpStatus.BAD_REQUEST, "Only image files are allowed (jpg, png, gif, webp)"),
    REVIEW_NOT_FOUND(HttpStatus.NOT_FOUND, "Review not found"),
    REVIEW_ALREADY_EXISTS(HttpStatus.CONFLICT, "Booking đã được đánh giá"),
    REVIEW_BOOKING_NOT_ELIGIBLE(HttpStatus.BAD_REQUEST, "Booking không hợp lệ: phải thuộc về bạn và ở trạng thái CHECKED_OUT"),
    REVIEW_INVALID_RATING(HttpStatus.BAD_REQUEST, "Rating phải trong khoảng 1–5"),
    REVIEW_ACCESS_DENIED(HttpStatus.FORBIDDEN, "Bạn không có quyền thao tác với review này"),
    REVIEW_REPLY_BLANK(HttpStatus.BAD_REQUEST, "Nội dung phản hồi không được để trống"),
    REVIEW_INVALID_STATUS(HttpStatus.BAD_REQUEST, "Status không hợp lệ"),
    QR_INVALID(HttpStatus.BAD_REQUEST, "QR code is invalid or has expired"),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");

    private final HttpStatus httpStatus;
    private final String message;
}
