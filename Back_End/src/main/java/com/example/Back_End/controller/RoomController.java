package com.example.Back_End.controller;

import com.example.Back_End.dto.request.RoomRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.DateRangeResponse;
import com.example.Back_End.dto.response.RoomResponse;
import com.example.Back_End.model.enums.RoomType;
import com.example.Back_End.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping("/available")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAvailableRooms(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,
            @RequestParam(required = false) RoomType type) {
        return ResponseEntity.ok(ApiResponse.<List<RoomResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(roomService.getAvailableRooms(hotelId, checkIn, checkOut, type))
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RoomResponse>> getRoomById(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.<RoomResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(roomService.getRoomById(id))
                .build());
    }

    @GetMapping("/{id}/booked-dates")
    public ResponseEntity<ApiResponse<List<DateRangeResponse>>> getBookedDates(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.<List<DateRangeResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(roomService.getBookedDates(id))
                .build());
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<RoomResponse>> createRoom(
            @RequestBody RoomRequest request,
            Authentication authentication) {
        String ownerEmail = (String) authentication.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<RoomResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("Room created")
                        .data(roomService.createRoom(ownerEmail, request))
                        .build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<RoomResponse>> updateRoom(
            @PathVariable String id,
            @RequestBody RoomRequest request,
            Authentication authentication) {
        String ownerEmail = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<RoomResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Room updated")
                .data(roomService.updateRoom(id, ownerEmail, request))
                .build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<Void>> deleteRoom(
            @PathVariable String id,
            Authentication authentication) {
        String ownerEmail = (String) authentication.getPrincipal();
        roomService.deleteRoom(id, ownerEmail);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Room deleted")
                .build());
    }
}
