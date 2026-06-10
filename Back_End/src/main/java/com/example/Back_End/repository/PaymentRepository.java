package com.example.Back_End.repository;

import com.example.Back_End.model.Payment;
import com.example.Back_End.model.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends MongoRepository<Payment, String> {

    List<Payment> findByBookingIdOrderByCreatedAtDesc(String bookingId);

    List<Payment> findByUserIdOrderByCreatedAtDesc(String userId);

    // paginated — for my-payments history
    Page<Payment> findByUserId(String userId, Pageable pageable);

    Page<Payment> findByUserIdAndStatus(String userId, PaymentStatus status, Pageable pageable);

    Optional<Payment> findByTransactionId(String transactionId);

    Optional<Payment> findByBookingIdAndStatus(String bookingId, PaymentStatus status);

    List<Payment> findAllByBookingIdAndStatus(String bookingId, PaymentStatus status);

    boolean existsByBookingIdAndStatus(String bookingId, PaymentStatus status);
}
