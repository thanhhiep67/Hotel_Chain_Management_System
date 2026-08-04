package com.example.Back_End.controller;

import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.StatsResponse;
import com.example.Back_End.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@Tag(name = "Stats", description = "Thống kê công khai cho trang chủ")
@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @Operation(summary = "Thống kê tổng: khách sạn, phòng, booking, user (public)")
    @GetMapping
    public ResponseEntity<ApiResponse<StatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.<StatsResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(statsService.getStats())
                .build());
    }

    @Operation(summary = "Số khách sạn theo danh sách thành phố (public)")
    @GetMapping("/cities")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getCityCounts(
            @RequestParam List<String> cities) {
        return ResponseEntity.ok(ApiResponse.<Map<String, Long>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(statsService.getCityCounts(cities))
                .build());
    }
}
