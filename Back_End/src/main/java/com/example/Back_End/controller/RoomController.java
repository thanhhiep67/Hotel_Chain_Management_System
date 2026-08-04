package com.example.Back_End.controller;

import com.example.Back_End.dto.request.RoomRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.DateRangeResponse;
import com.example.Back_End.dto.response.RoomResponse;
import com.example.Back_End.model.enums.RoomType;
import com.example.Back_End.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "Rooms", description = "Phòng khách sạn — tìm kiếm, tạo, cập nhật, xóa")
@RestController
@RequestMapping("/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @Operation(summary = "Phòng còn trống theo khoảng ngày (public)")
    @GetMapping("/available")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getAvailableRooms(
            @Parameter(description = "ID khách sạn", required = true) @RequestParam String hotelId,
            @Parameter(description = "Ngày nhận phòng (yyyy-MM-dd)", required = true) @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @Parameter(description = "Ngày trả phòng (yyyy-MM-dd)", required = true) @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,
            @Parameter(description = "Lọc theo loại phòng") @RequestParam(required = false) RoomType type) {
        return ResponseEntity.ok(ApiResponse.<List<RoomResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(roomService.getAvailableRooms(hotelId, checkIn, checkOut, type))
                .build());
    }

    @Operation(summary = "Chi tiết phòng theo ID (public)")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RoomResponse>> getRoomById(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.<RoomResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(roomService.getRoomById(id))
                .build());
    }

    @Operation(summary = "Các khoảng ngày đã đặt của phòng (public)")
    @GetMapping("/{id}/booked-dates")
    public ResponseEntity<ApiResponse<List<DateRangeResponse>>> getBookedDates(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.<List<DateRangeResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(roomService.getBookedDates(id))
                .build());
    }

    @Operation(summary = "Tạo phòng mới (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
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

    @Operation(summary = "Cập nhật thông tin phòng (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
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

    @Operation(summary = "Xóa phòng (OWNER)", security = @SecurityRequirement(name = "bearerAuth"))
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
