package com.example.Back_End.controller;

import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.RoomRecommendationResponse;
import com.example.Back_End.service.RecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Recommendations (USER)", description = "Gợi ý phòng theo AI — Content-Based & Collaborative")
@RestController
@RequestMapping("/recommendations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('USER')")
public class RecommendationController {

    private final RecommendationService recommendationService;

    @Operation(summary = "Gợi ý phòng hybrid (CBF + CF) (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomRecommendationResponse>>> getHybrid(
            @RequestParam(defaultValue = "6") int size,
            Authentication auth) {
        return ok(recommendationService
                .getHybridRecommendations((String) auth.getPrincipal(), size));
    }

    @Operation(summary = "Gợi ý theo nội dung — Content-Based Filtering (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/rooms")
    public ResponseEntity<ApiResponse<List<RoomRecommendationResponse>>> getContentBased(
            @RequestParam(defaultValue = "8") int size,
            Authentication auth) {
        return ok(recommendationService.getRecommendations((String) auth.getPrincipal(), size));
    }

    @Operation(summary = "Gợi ý theo hành vi người dùng tương tự — Collaborative Filtering (USER)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/rooms/collaborative")
    public ResponseEntity<ApiResponse<List<RoomRecommendationResponse>>> getCollaborative(
            @RequestParam(defaultValue = "8") int size,
            Authentication auth) {
        return ok(recommendationService
                .getCollaborativeRecommendations((String) auth.getPrincipal(), size));
    }

    private ResponseEntity<ApiResponse<List<RoomRecommendationResponse>>> ok(
            List<RoomRecommendationResponse> data) {
        return ResponseEntity.ok(ApiResponse.<List<RoomRecommendationResponse>>builder()
                .statusCode(200).message("Success").data(data).build());
    }
}
