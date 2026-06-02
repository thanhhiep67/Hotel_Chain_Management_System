package com.example.Back_End.service;

import com.example.Back_End.dto.request.CreateDiscountRequest;
import com.example.Back_End.dto.request.ValidateDiscountRequest;
import com.example.Back_End.dto.response.DiscountResponse;
import com.example.Back_End.dto.response.ValidateDiscountResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Discount;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.DiscountStatus;
import com.example.Back_End.model.enums.DiscountType;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.repository.DiscountRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DiscountService {

    private final DiscountRepository discountRepository;
    private final HotelRepository    hotelRepository;
    private final UserRepository     userRepository;
    private final MongoTemplate      mongoTemplate;

    /* ══════════════════════════ CRUD ══════════════════════════ */

    public DiscountResponse createDiscount(String creatorEmail, CreateDiscountRequest req) {
        User creator = resolve(creatorEmail);

        if (creator.getRole() == UserRole.OWNER && req.getHotelId() != null) {
            hotelRepository.findById(req.getHotelId())
                    .filter(h -> h.getOwnerId().equals(creator.getId()))
                    .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_OWNED));
        }

        if (discountRepository.existsByCode(req.getCode().toUpperCase())) {
            throw new AppException(ErrorCode.DISCOUNT_CODE_EXISTS);
        }

        Discount discount = Discount.builder()
                .code(req.getCode().toUpperCase())
                .name(req.getName())
                .type(req.getType())
                .value(req.getValue())
                .minOrderAmount(req.getMinOrderAmount())
                .maxDiscount(req.getMaxDiscount())
                .usageLimit(req.getUsageLimit())
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .hotelId(req.getHotelId())
                .createdBy(creator.getId())
                .status(DiscountStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();

        return toResponse(discountRepository.save(discount));
    }

    public DiscountResponse updateDiscount(String id, CreateDiscountRequest req, String actorEmail) {
        Discount discount = discountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));
        verifyAccess(discount, actorEmail);

        String newCode = req.getCode().toUpperCase();
        if (!discount.getCode().equals(newCode) && discountRepository.existsByCode(newCode)) {
            throw new AppException(ErrorCode.DISCOUNT_CODE_EXISTS);
        }

        discount.setCode(newCode);
        discount.setName(req.getName());
        discount.setType(req.getType());
        discount.setValue(req.getValue());
        discount.setMinOrderAmount(req.getMinOrderAmount());
        discount.setMaxDiscount(req.getMaxDiscount());
        discount.setUsageLimit(req.getUsageLimit());
        discount.setStartDate(req.getStartDate());
        discount.setEndDate(req.getEndDate());
        discount.setHotelId(req.getHotelId());

        return toResponse(discountRepository.save(discount));
    }

    public void deleteDiscount(String id, String actorEmail) {
        Discount discount = discountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));
        verifyAccess(discount, actorEmail);

        if (discount.getUsedCount() > 0) {
            throw new AppException(ErrorCode.DISCOUNT_HAS_BEEN_USED);
        }

        discountRepository.delete(discount);
    }

    /* ══════════════════════════ QUERY ══════════════════════════ */

    public List<DiscountResponse> getDiscounts(String actorEmail, DiscountStatus status) {
        User actor = resolve(actorEmail);
        List<Discount> result;

        if (actor.getRole() == UserRole.ADMIN) {
            result = status != null
                    ? discountRepository.findByStatus(status)
                    : discountRepository.findAll();
        } else {
            result = status != null
                    ? discountRepository.findByCreatedByAndStatus(actor.getId(), status)
                    : discountRepository.findByCreatedBy(actor.getId());
        }
        return result.stream().map(this::toResponse).toList();
    }

    /** Public — USER xem discount đang active (không lộ usageLimit / usedCount) */
    public List<DiscountResponse> getActiveDiscounts() {
        return discountRepository.findByStatus(DiscountStatus.ACTIVE)
                .stream().map(this::toPublicResponse).toList();
    }

    /* ══════════════════════════ TOGGLE ══════════════════════════ */

    public DiscountResponse toggleActive(String id, String actorEmail) {
        Discount discount = discountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));
        verifyAccess(discount, actorEmail);

        if (discount.getStatus() == DiscountStatus.EXPIRED) {
            throw new AppException(ErrorCode.DISCOUNT_EXPIRED);
        }

        discount.setStatus(discount.getStatus() == DiscountStatus.ACTIVE
                ? DiscountStatus.INACTIVE
                : DiscountStatus.ACTIVE);

        return toResponse(discountRepository.save(discount));
    }

    /* ══════════════════════════ VALIDATE ══════════════════════════ */

    public ValidateDiscountResponse validate(ValidateDiscountRequest req) {
        Discount discount = discountRepository.findByCode(req.getCode().toUpperCase())
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));

        checkApplicable(discount, req.getHotelId(), req.getOrderAmount());

        double discountAmount = calculate(discount, req.getOrderAmount());
        return ValidateDiscountResponse.builder()
                .discountId(discount.getId())
                .code(discount.getCode())
                .type(discount.getType())
                .value(discount.getValue())
                .discountAmount(discountAmount)
                .finalPrice(req.getOrderAmount() - discountAmount)
                .build();
    }

    /* ══════════════════════════ ATOMIC OPS ══════════════════════════ */

    public void incrementUsedCount(String discountId) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(discountId)),
                new Update().inc("usedCount", 1),
                Discount.class);
    }

    /* ══════════════════════════ SCHEDULER ══════════════════════════ */

    /** Chạy lúc 00:00 hàng ngày — tự động expire mã hết hạn */
    @Scheduled(cron = "0 0 0 * * *")
    public void autoExpireDiscounts() {
        mongoTemplate.updateMulti(
                Query.query(
                        Criteria.where("endDate").lt(LocalDate.now())
                                .and("status").ne(DiscountStatus.EXPIRED)),
                Update.update("status", DiscountStatus.EXPIRED),
                Discount.class);
    }

    /* ══════════════════════════ HELPERS ══════════════════════════ */

    private void checkApplicable(Discount discount, String hotelId, double orderAmount) {
        switch (discount.getStatus()) {
            case EXPIRED  -> throw new AppException(ErrorCode.DISCOUNT_EXPIRED);
            case INACTIVE -> throw new AppException(ErrorCode.DISCOUNT_INACTIVE);
            default -> { /* ACTIVE — continue */ }
        }

        LocalDate today = LocalDate.now();
        if (today.isBefore(discount.getStartDate()) || today.isAfter(discount.getEndDate())) {
            throw new AppException(ErrorCode.DISCOUNT_EXPIRED);
        }

        if (discount.getUsageLimit() != null && discount.getUsedCount() >= discount.getUsageLimit()) {
            throw new AppException(ErrorCode.DISCOUNT_USAGE_LIMIT_REACHED);
        }

        if (orderAmount < discount.getMinOrderAmount()) {
            throw new AppException(ErrorCode.DISCOUNT_MIN_ORDER_NOT_MET);
        }

        if (discount.getHotelId() != null && !discount.getHotelId().equals(hotelId)) {
            throw new AppException(ErrorCode.DISCOUNT_NOT_APPLICABLE);
        }
    }

    private double calculate(Discount discount, double orderAmount) {
        double amount = discount.getType() == DiscountType.PERCENTAGE
                ? orderAmount * discount.getValue() / 100.0
                : discount.getValue();

        if (discount.getType() == DiscountType.PERCENTAGE && discount.getMaxDiscount() != null) {
            amount = Math.min(amount, discount.getMaxDiscount());
        }
        return Math.min(amount, orderAmount);
    }

    private void verifyAccess(Discount discount, String actorEmail) {
        User actor = resolve(actorEmail);
        if (actor.getRole() != UserRole.ADMIN && !discount.getCreatedBy().equals(actor.getId())) {
            throw new AppException(ErrorCode.HOTEL_NOT_OWNED);
        }
    }

    private User resolve(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private DiscountResponse toResponse(Discount d) {
        return DiscountResponse.builder()
                .id(d.getId())
                .code(d.getCode())
                .name(d.getName())
                .type(d.getType())
                .value(d.getValue())
                .minOrderAmount(d.getMinOrderAmount())
                .maxDiscount(d.getMaxDiscount())
                .usageLimit(d.getUsageLimit())
                .usedCount(d.getUsedCount())
                .startDate(d.getStartDate())
                .endDate(d.getEndDate())
                .hotelId(d.getHotelId())
                .status(d.getStatus())
                .createdAt(d.getCreatedAt())
                .build();
    }

    /** Public response — ẩn usageLimit / usedCount */
    private DiscountResponse toPublicResponse(Discount d) {
        return DiscountResponse.builder()
                .id(d.getId())
                .code(d.getCode())
                .name(d.getName())
                .type(d.getType())
                .value(d.getValue())
                .minOrderAmount(d.getMinOrderAmount())
                .maxDiscount(d.getMaxDiscount())
                .startDate(d.getStartDate())
                .endDate(d.getEndDate())
                .hotelId(d.getHotelId())
                .status(d.getStatus())
                .build();
    }
}
