package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.PaymentMethod;
import com.example.Back_End.model.enums.PaymentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PaymentNotification {
    private String eventType;     // PAYMENT_SUCCESS | PAYMENT_FAILED
    private String paymentId;
    private String bookingId;
    private String hotelId;
    private PaymentMethod method;
    private Double amount;
    private String currency;
    private PaymentStatus status;
    private String transactionId;
    private LocalDateTime paidAt;
}
