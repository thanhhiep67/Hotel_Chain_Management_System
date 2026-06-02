package com.example.Back_End.controller;

import com.example.Back_End.dto.request.AssignStaffRequest;
import com.example.Back_End.dto.request.HotelRequest;
import com.example.Back_End.dto.request.UpdateHotelStatusRequest;
import com.example.Back_End.dto.response.ApiResponse;
import com.example.Back_End.dto.response.HotelDetailResponse;
import com.example.Back_End.dto.response.HotelResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.model.enums.HotelStatus;
import com.example.Back_End.model.enums.RoomType;
import com.example.Back_End.service.HotelService;
import lombok.RequiredArgsConstructor;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/hotels")
@RequiredArgsConstructor
public class HotelController {

    private final HotelService hotelService;

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<ApiResponse<HotelResponse>> updateHotel(
            @PathVariable String id,
            @RequestBody HotelRequest request,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        String role = authentication.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
        return ResponseEntity.ok(ApiResponse.<HotelResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Hotel updated successfully")
                .data(hotelService.updateHotel(id, email, role, request))
                .build());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<HotelResponse>>> searchHotels(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) RoomType type,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.<PageResponse<HotelResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(hotelService.searchHotels(city, type, minPrice, maxPrice, page, size))
                .build());
    }

    @PatchMapping("/{id}/assign-staff")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<Void>> assignStaff(
            @PathVariable String id,
            @RequestBody AssignStaffRequest request,
            Authentication authentication) {
        String ownerEmail = (String) authentication.getPrincipal();
        hotelService.assignStaff(id, ownerEmail, request);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Staff assigned successfully")
                .build());
    }

    @GetMapping("/my-hotels")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<List<HotelResponse>>> getMyHotels(Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.<List<HotelResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(hotelService.getMyHotels(email))
                .build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<HotelDetailResponse>> getHotelById(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.<HotelDetailResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(hotelService.getHotelById(id))
                .build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteHotel(
            @PathVariable String id,
            Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        String role = authentication.getAuthorities().iterator().next().getAuthority().replace("ROLE_", "");
        hotelService.deleteHotel(id, email, role);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Hotel deactivated successfully")
                .build());
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<HotelResponse>>> getAllHotelsAdmin(
            @RequestParam(required = false) HotelStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.<PageResponse<HotelResponse>>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Success")
                .data(hotelService.getAllHotelsAdmin(status, page, size))
                .build());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<HotelResponse>> updateStatus(
            @PathVariable String id,
            @RequestBody UpdateHotelStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.<HotelResponse>builder()
                .statusCode(HttpStatus.OK.value())
                .message("Hotel status updated to " + request.getStatus())
                .data(hotelService.updateStatus(id, request))
                .build());
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ApiResponse<HotelResponse>> createHotel(
            @RequestBody HotelRequest request,
            Authentication authentication) {
        String ownerEmail = (String) authentication.getPrincipal();
        HotelResponse response = hotelService.createHotel(ownerEmail, request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.<HotelResponse>builder()
                        .statusCode(HttpStatus.CREATED.value())
                        .message("Hotel created successfully. Waiting for Admin approval.")
                        .data(response)
                        .build());
    }
}
