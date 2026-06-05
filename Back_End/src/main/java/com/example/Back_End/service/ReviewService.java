package com.example.Back_End.service;

import com.example.Back_End.dto.request.OwnerReplyRequest;
import com.example.Back_End.dto.request.ReviewRequest;
import com.example.Back_End.dto.request.UpdateReviewStatusRequest;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.ReviewResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Review;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.ReviewStatus;
import com.example.Back_End.model.ReviewAlert;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.ReviewAlertRepository;
import com.example.Back_End.repository.ReviewRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository      reviewRepository;
    private final ReviewAlertRepository reviewAlertRepository;
    private final BookingRepository     bookingRepository;
    private final HotelRepository       hotelRepository;
    private final UserRepository        userRepository;
    private final MongoTemplate         mongoTemplate;

    // ── Tạo review ──────────────────────────────────────────────────────────

    @CacheEvict(value = "analytics:overview", key = "#result.hotelId")
    public ReviewResponse createReview(String userEmail, ReviewRequest req) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        validateRatings(req.getOverallRating(), req.getCleanlinessRating(),
                        req.getServiceRating(),  req.getLocationRating());

        Booking booking = bookingRepository.findById(req.getBookingId())
                .orElseThrow(() -> new AppException(ErrorCode.BOOKING_NOT_FOUND));

        if (!booking.getUserId().equals(user.getId())
                || booking.getStatus() != BookingStatus.CHECKED_OUT) {
            throw new AppException(ErrorCode.REVIEW_BOOKING_NOT_ELIGIBLE);
        }

        Hotel hotel = hotelRepository.findById(booking.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        Review saved;
        try {
            saved = reviewRepository.save(Review.builder()
                    .bookingId(req.getBookingId())
                    .userId(user.getId())
                    .hotelId(hotel.getId())
                    .overallRating(req.getOverallRating())
                    .cleanlinessRating(req.getCleanlinessRating())
                    .serviceRating(req.getServiceRating())
                    .locationRating(req.getLocationRating())
                    .comment(req.getComment() != null ? req.getComment().trim() : "")
                    .images(req.getImages() != null ? req.getImages() : List.of())
                    .status(ReviewStatus.APPROVED)
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (DuplicateKeyException e) {
            // unique index bookingId đã bắt ở DB level (an toàn với race condition)
            throw new AppException(ErrorCode.REVIEW_ALREADY_EXISTS);
        }

        recalcHotelRating(hotel.getId());
        checkAbnormalPattern(user, hotel, saved);

        return toResponse(saved, user.getFullName(), hotel.getName());
    }

    // ── Phản hồi của owner ───────────────────────────────────────────────────

    public ReviewResponse addOwnerReply(String ownerEmail, String reviewId, OwnerReplyRequest req) {
        if (req.getReply() == null || req.getReply().isBlank())
            throw new AppException(ErrorCode.REVIEW_REPLY_BLANK);

        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new AppException(ErrorCode.REVIEW_NOT_FOUND));

        Hotel hotel = hotelRepository.findById(review.getHotelId())
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        if (!hotel.getOwnerId().equals(owner.getId()))
            throw new AppException(ErrorCode.REVIEW_ACCESS_DENIED);

        review.setOwnerReply(req.getReply().trim());
        review.setOwnerRepliedAt(LocalDateTime.now());
        Review saved = reviewRepository.save(review);

        String userName = userRepository.findById(review.getUserId())
                .map(User::getFullName).orElse("—");

        return toResponse(saved, userName, hotel.getName());
    }

    // ── Admin: ẩn / khôi phục review ────────────────────────────────────────

    public ReviewResponse updateStatus(String reviewId, UpdateReviewStatusRequest req) {
        if (req.getStatus() == null)
            throw new AppException(ErrorCode.REVIEW_INVALID_STATUS);

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new AppException(ErrorCode.REVIEW_NOT_FOUND));

        ReviewStatus before = review.getStatus();
        review.setStatus(req.getStatus());
        Review saved = reviewRepository.save(review);

        // Chỉ recalc khi visibility thay đổi (APPROVED ↔ non-APPROVED)
        boolean wasApproved = before == ReviewStatus.APPROVED;
        boolean isApproved  = req.getStatus() == ReviewStatus.APPROVED;
        if (wasApproved != isApproved) {
            recalcHotelRating(review.getHotelId());
        }

        String userName  = userRepository.findById(review.getUserId()).map(User::getFullName).orElse("—");
        String hotelName = hotelRepository.findById(review.getHotelId()).map(Hotel::getName).orElse("—");
        return toResponse(saved, userName, hotelName);
    }

    // ── Public: lấy review của hotel (chỉ APPROVED) ─────────────────────────

    public PageResponse<ReviewResponse> getHotelReviews(
            String hotelId, int page, int size, String sort, Integer rating) {
        Sort sortObj = switch (sort) {
            case "rating_desc" -> Sort.by(Sort.Direction.DESC, "overallRating");
            case "rating_asc"  -> Sort.by(Sort.Direction.ASC,  "overallRating");
            default            -> Sort.by(Sort.Direction.DESC, "createdAt");
        };

        Pageable pageable = PageRequest.of(page, size, sortObj);
        Page<Review> reviewPage = (rating != null && rating >= 1 && rating <= 5)
                ? reviewRepository.findByHotelIdAndStatusAndOverallRating(
                        hotelId, ReviewStatus.APPROVED, rating, pageable)
                : reviewRepository.findByHotelIdAndStatus(
                        hotelId, ReviewStatus.APPROVED, pageable);

        // Batch fetch userNames — 1 query thay vì N queries
        List<String> userIds = reviewPage.getContent().stream()
                .map(Review::getUserId).distinct().collect(Collectors.toList());
        Map<String, String> userNames = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        String hotelName = hotelRepository.findById(hotelId).map(Hotel::getName).orElse("—");

        List<ReviewResponse> content = reviewPage.getContent().stream()
                .map(r -> toResponse(r, userNames.getOrDefault(r.getUserId(), "—"), hotelName))
                .collect(Collectors.toList());

        return PageResponse.<ReviewResponse>builder()
                .content(content).page(page).size(size)
                .totalElements(reviewPage.getTotalElements())
                .totalPages(reviewPage.getTotalPages())
                .build();
    }

    // ── Phát hiện review bất thường ─────────────────────────────────────────

    private void checkAbnormalPattern(User user, Hotel hotel, Review saved) {
        List<Review> last3 = reviewRepository
                .findTop3ByUserIdOrderByCreatedAtDesc(user.getId());

        if (last3.size() < 3) return;

        boolean allOneStar = last3.stream().allMatch(r -> r.getOverallRating() == 1);
        if (!allOneStar) return;

        // Không tạo alert trùng nếu đã có alert chưa giải quyết
        if (reviewAlertRepository.existsByUserIdAndResolvedFalse(user.getId())) return;

        List<String> reviewIds = last3.stream().map(Review::getId).collect(Collectors.toList());

        reviewAlertRepository.save(ReviewAlert.builder()
                .userId(user.getId())
                .userFullName(user.getFullName())
                .userEmail(user.getEmail())
                .hotelId(hotel.getId())
                .hotelName(hotel.getName())
                .reviewIds(reviewIds)
                .triggerReviewId(saved.getId())
                .triggeredAt(LocalDateTime.now())
                .resolved(false)
                .build());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void validateRatings(Integer... ratings) {
        for (Integer r : ratings) {
            if (r == null || r < 1 || r > 5)
                throw new AppException(ErrorCode.REVIEW_INVALID_RATING);
        }
    }

    /**
     * MongoDB tính $avg + $count server-side → chỉ 2 số được truyền về Java.
     * Update hotel bằng $set — không cần load toàn bộ Hotel document.
     */
    private void recalcHotelRating(String hotelId) {
        // Dùng .name() thay vì enum — MongoTemplate với Document.class output
        // không tự convert enum → kết quả match 0 row nếu để nguyên enum
        Aggregation agg = Aggregation.newAggregation(
            Aggregation.match(
                Criteria.where("hotelId").is(hotelId)
                        .and("status").is(ReviewStatus.APPROVED.name())
            ),
            Aggregation.group()
                .avg("overallRating").as("avg")
                .count().as("total")
        );

        AggregationResults<Document> results =
                mongoTemplate.aggregate(agg, "reviews", Document.class);
        Document doc = results.getUniqueMappedResult();

        double avg   = doc != null ? ((Number) doc.get("avg")).doubleValue() : 0.0;
        int    count = doc != null ? ((Number) doc.get("total")).intValue()  : 0;

        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").is(hotelId)),
            new Update()
                .set("avgRating",   Math.round(avg * 10.0) / 10.0)
                .set("reviewCount", count),
            Hotel.class
        );
    }

    private ReviewResponse toResponse(Review r, String userName, String hotelName) {
        return ReviewResponse.builder()
                .id(r.getId())
                .bookingId(r.getBookingId())
                .userId(r.getUserId())
                .hotelId(r.getHotelId())
                .userName(userName)
                .hotelName(hotelName)
                .overallRating(r.getOverallRating())
                .cleanlinessRating(r.getCleanlinessRating())
                .serviceRating(r.getServiceRating())
                .locationRating(r.getLocationRating())
                .comment(r.getComment())
                .images(r.getImages())
                .ownerReply(r.getOwnerReply())
                .ownerRepliedAt(r.getOwnerRepliedAt())
                .status(r.getStatus())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
