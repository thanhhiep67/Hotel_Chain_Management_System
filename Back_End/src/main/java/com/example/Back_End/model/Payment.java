package com.example.Back_End.model;

import com.example.Back_End.model.enums.PaymentMethod;
import com.example.Back_End.model.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "payments")
@CompoundIndexes({
    // covers findByUserId + sort by createdAt; userId queries use this as leading field
    @CompoundIndex(name = "idx_user_created",   def = "{'userId': 1, 'createdAt': -1}"),
    // covers findByBookingId + findByBookingIdAndStatus; bookingId queries use leading field
    @CompoundIndex(name = "idx_booking_status", def = "{'bookingId': 1, 'status': 1}")
})
public class Payment {

    @Id
    private String id;

    // no standalone @Indexed — covered as leading field in idx_booking_status
    private String bookingId;

    // no standalone @Indexed — covered as leading field in idx_user_created
    private String userId;

    private PaymentMethod method;

    private Double amount;

    @Builder.Default
    private String currency = "VND";

    // standalone index for admin/batch queries (find all PENDING, FAILED, etc.)
    @Indexed
    @Builder.Default
    private PaymentStatus status = PaymentStatus.PENDING;

    // unique per gateway transaction; sparse = null values are not indexed
    @Indexed(unique = true, sparse = true)
    private String transactionId;

    private String gatewayResponse;

    private String paymentUrl;

    private LocalDateTime paidAt;

    private LocalDateTime refundedAt;

    private String refundReason;

    private LocalDateTime createdAt;
}
