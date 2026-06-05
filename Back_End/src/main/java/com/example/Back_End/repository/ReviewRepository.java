package com.example.Back_End.repository;

import com.example.Back_End.model.Review;
import com.example.Back_End.model.enums.ReviewStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ReviewRepository extends MongoRepository<Review, String> {

    boolean existsByBookingId(String bookingId);

    // Lấy review của hotel theo status — dùng idx_hotel_status
    Page<Review> findByHotelIdAndStatus(String hotelId, ReviewStatus status, Pageable pageable);

    // Filter thêm theo số sao
    Page<Review> findByHotelIdAndStatusAndOverallRating(
            String hotelId, ReviewStatus status, int overallRating, Pageable pageable);

    // Lấy review của user
    Page<Review> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    // 3 review gần nhất của user — dùng cho phát hiện bất thường
    List<Review> findTop3ByUserIdOrderByCreatedAtDesc(String userId);
}
