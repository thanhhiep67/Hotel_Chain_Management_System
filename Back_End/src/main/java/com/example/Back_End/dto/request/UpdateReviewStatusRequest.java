package com.example.Back_End.dto.request;

import com.example.Back_End.model.enums.ReviewStatus;
import lombok.Data;

@Data
public class UpdateReviewStatusRequest {
    private ReviewStatus status;
}
