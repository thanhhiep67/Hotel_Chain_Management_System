package com.example.Back_End.model;

import com.example.Back_End.model.enums.DiscountStatus;
import com.example.Back_End.model.enums.DiscountType;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document("discounts")
@CompoundIndex(name = "idx_discount_dates", def = "{'startDate': 1, 'endDate': 1}")
public class Discount {

    @Id
    private String id;

    @Indexed(unique = true)
    private String code;

    private String name;

    private DiscountType type;

    private double value;

    @Builder.Default
    private double minOrderAmount = 0;

    /** Trần giảm tối đa cho loại PERCENTAGE. null = không giới hạn. */
    private Double maxDiscount;

    /** null = không giới hạn số lần dùng */
    private Integer usageLimit;

    @Builder.Default
    private int usedCount = 0;

    private LocalDate startDate;
    private LocalDate endDate;

    /** null = áp dụng toàn hệ thống */
    @Indexed
    private String hotelId;

    private String createdBy;

    @Builder.Default
    @Indexed
    private DiscountStatus status = DiscountStatus.ACTIVE;

    private LocalDateTime createdAt;
}
