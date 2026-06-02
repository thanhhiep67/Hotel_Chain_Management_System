package com.example.Back_End.repository;

import com.example.Back_End.model.Discount;
import com.example.Back_End.model.enums.DiscountStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface DiscountRepository extends MongoRepository<Discount, String> {

    Optional<Discount> findByCode(String code);
    boolean existsByCode(String code);

    List<Discount> findByCreatedBy(String createdBy);
    List<Discount> findByStatus(DiscountStatus status);
    List<Discount> findByCreatedByAndStatus(String createdBy, DiscountStatus status);

    /** Discount áp dụng toàn hệ thống HOẶC cho hotel cụ thể */
    @Query("{ 'status': ?0, '$or': [ { 'hotelId': null }, { 'hotelId': ?1 } ] }")
    List<Discount> findActiveForHotel(DiscountStatus status, String hotelId);
}
