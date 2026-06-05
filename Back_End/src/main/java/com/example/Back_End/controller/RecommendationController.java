package com.example.Back_End.controller;

import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.RoomRecommendationResponse;
import com.example.Back_End.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/recommendations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('USER')")
public class RecommendationController {

    private final RecommendationService recommendationService;

    /** GET /recommendations?size=6  —  Hybrid (CBF + CF) */
    @GetMapping
    public ResponseEntity<ApiResponse<List<RoomRecommendationResponse>>> getHybrid(
            @RequestParam(defaultValue = "6") int size,
            Authentication auth) {
        return ok(recommendationService
                .getHybridRecommendations((String) auth.getPrincipal(), size));
    }

    /** GET /recommendations/rooms?size=8  —  Content-based Filtering */
    @GetMapping("/rooms")
    public ResponseEntity<ApiResponse<List<RoomRecommendationResponse>>> getContentBased(
            @RequestParam(defaultValue = "8") int size,
            Authentication auth) {
        return ok(recommendationService.getRecommendations((String) auth.getPrincipal(), size));
    }

    /** GET /recommendations/rooms/collaborative?size=8  —  Collaborative Filtering */
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
