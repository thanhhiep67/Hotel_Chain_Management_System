package com.example.Back_End.controller;

import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.StatsResponse;
import com.example.Back_End.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @GetMapping
    public ResponseEntity<ApiResponse<StatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.<StatsResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(statsService.getStats())
                .build());
    }

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
