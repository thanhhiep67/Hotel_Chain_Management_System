package com.example.Back_End.dto.response;

import com.example.Back_End.model.enums.PaymentMethod;
import com.example.Back_End.model.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentResponse {
    private String paymentId;
    private String bookingId;
    private String userId;
    private PaymentMethod method;
    private Double amount;
    private String currency;
    private PaymentStatus status;
    private String paymentUrl;
    private String transactionId;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
    private LocalDateTime refundedAt;
    private String refundReason;
    // only populated for Admin / Owner / Staff — null for regular users
    private String gatewayResponse;
}
