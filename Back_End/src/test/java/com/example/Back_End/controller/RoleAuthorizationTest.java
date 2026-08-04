package com.example.Back_End.controller;

import com.example.Back_End.config.CorsConfig;
import com.example.Back_End.config.SecurityConfig;
import com.example.Back_End.dto.request.HotelRequest;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.service.BookingService;
import com.example.Back_End.service.HotelService;
import com.example.Back_End.service.JwtService;
import com.example.Back_End.service.QrCodeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * MockMvc role-authorization tests.
 *
 * Auth strategy: SecurityMockMvcRequestPostProcessors.authentication() directly injects a
 * UsernamePasswordAuthenticationToken with a String principal (email) — exactly what
 * JwtAuthFilter produces, and what controllers expect when they cast getPrincipal() to String.
 *
 * @WebMvcTest loads:
 *  - Both controllers + GlobalExceptionHandler
 *  - JwtAuthFilter (Filter component) — requires @MockitoBean JwtService
 *  - WebConfig → RecommendationRateLimitInterceptor → @MockitoBean RedisTemplate
 *  - WebMvcConfig — needs ${app.upload.dir} via @TestPropertySource
 *  - SecurityConfig (@EnableWebSecurity) — loaded via @Import to activate CSRF-disable + @EnableMethodSecurity
 */
@WebMvcTest(controllers = {HotelController.class, BookingController.class})
@Import({CorsConfig.class, SecurityConfig.class})
@TestPropertySource(properties = "app.upload.dir=.")
@DisplayName("Role authorization — controller layer")
class RoleAuthorizationTest {

    @Autowired MockMvc      mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean HotelService   hotelService;
    @MockitoBean BookingService bookingService;
    @MockitoBean QrCodeService  qrCodeService;
    @MockitoBean JwtService     jwtService;

    @SuppressWarnings("rawtypes")
    @MockitoBean RedisTemplate  redisTemplate;

    /** Builds an authentication post-processor with String principal (email). */
    private static RequestPostProcessor withRole(String email, String role) {
        return SecurityMockMvcRequestPostProcessors.authentication(
                new UsernamePasswordAuthenticationToken(
                        email, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                )
        );
    }

    private String minimalHotelJson() throws Exception {
        HotelRequest req = new HotelRequest();
        req.setName("Test Hotel");
        req.setCity("Hanoi");
        return objectMapper.writeValueAsString(req);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /hotels/{id}  —  @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("PUT /hotels/{id} — chỉnh sửa khách sạn")
    class HotelUpdateAuth {

        @Test
        @DisplayName("USER → 403 blocked by @PreAuthorize")
        void user_cannotUpdateHotel() throws Exception {
            mockMvc.perform(put("/hotels/hotel-1")
                            .with(withRole("user@test.com", "USER"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("STAFF → 403 blocked by @PreAuthorize")
        void staff_cannotUpdateHotel() throws Exception {
            mockMvc.perform(put("/hotels/hotel-1")
                            .with(withRole("staff@test.com", "STAFF"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("No token → 401 Unauthorized")
        void anonymous_cannotUpdateHotel() throws Exception {
            mockMvc.perform(put("/hotels/hotel-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("OWNER với hotel của chính mình → 200")
        void owner_canUpdateOwnHotel() throws Exception {
            when(hotelService.updateHotel(anyString(), anyString(), anyString(), any()))
                    .thenReturn(null);

            mockMvc.perform(put("/hotels/hotel-1")
                            .with(withRole("owner@test.com", "OWNER"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.statusCode").value(200));
        }

        @Test
        @DisplayName("OWNER với hotel của owner khác → 403 HOTEL_NOT_OWNED từ service")
        void owner_cannotUpdateOtherOwnersHotel() throws Exception {
            when(hotelService.updateHotel(anyString(), anyString(), anyString(), any()))
                    .thenThrow(new AppException(ErrorCode.HOTEL_NOT_OWNED));

            mockMvc.perform(put("/hotels/hotel-1")
                            .with(withRole("owner@test.com", "OWNER"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(ErrorCode.HOTEL_NOT_OWNED.getMessage()));
        }

        @Test
        @DisplayName("ADMIN → 200 (có thể sửa bất kỳ hotel)")
        void admin_canUpdateAnyHotel() throws Exception {
            when(hotelService.updateHotel(anyString(), anyString(), anyString(), any()))
                    .thenReturn(null);

            mockMvc.perform(put("/hotels/hotel-1")
                            .with(withRole("admin@test.com", "ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isOk());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /bookings/{id}/confirm  —  @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("PATCH /bookings/{id}/confirm — xác nhận booking")
    class BookingConfirmAuth {

        @Test
        @DisplayName("USER → 403 blocked by @PreAuthorize — cốt lõi của test suite này")
        void user_cannotConfirmBooking() throws Exception {
            mockMvc.perform(patch("/bookings/bk-1/confirm")
                            .with(withRole("user@test.com", "USER")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.statusCode").value(403));
        }

        @Test
        @DisplayName("ADMIN → 403 (không nằm trong hasAnyRole OWNER/STAFF)")
        void admin_cannotConfirmBooking() throws Exception {
            mockMvc.perform(patch("/bookings/bk-1/confirm")
                            .with(withRole("admin@test.com", "ADMIN")))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("No token → 401 Unauthorized")
        void anonymous_cannotConfirmBooking() throws Exception {
            mockMvc.perform(patch("/bookings/bk-1/confirm"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("OWNER → 200")
        void owner_canConfirmBooking() throws Exception {
            when(bookingService.confirmBooking(anyString(), anyString())).thenReturn(null);

            mockMvc.perform(patch("/bookings/bk-1/confirm")
                            .with(withRole("owner@test.com", "OWNER")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.statusCode").value(200));
        }

        @Test
        @DisplayName("STAFF → 200")
        void staff_canConfirmBooking() throws Exception {
            when(bookingService.confirmBooking(anyString(), anyString())).thenReturn(null);

            mockMvc.perform(patch("/bookings/bk-1/confirm")
                            .with(withRole("staff@test.com", "STAFF")))
                    .andExpect(status().isOk());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OWNER-only: POST /hotels, GET /hotels/my-hotels
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("OWNER-only endpoints — USER/STAFF bị chặn")
    class OwnerOnlyEndpoints {

        @Test
        @DisplayName("POST /hotels — USER → 403")
        void user_cannotCreateHotel() throws Exception {
            mockMvc.perform(post("/hotels")
                            .with(withRole("user@test.com", "USER"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("POST /hotels — STAFF → 403")
        void staff_cannotCreateHotel() throws Exception {
            mockMvc.perform(post("/hotels")
                            .with(withRole("staff@test.com", "STAFF"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(minimalHotelJson()))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /hotels/my-hotels — USER → 403")
        void user_cannotViewMyHotels() throws Exception {
            mockMvc.perform(get("/hotels/my-hotels")
                            .with(withRole("user@test.com", "USER")))
                    .andExpect(status().isForbidden());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN-only: GET /hotels/admin
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("ADMIN-only endpoints")
    class AdminOnlyEndpoints {

        @Test
        @DisplayName("GET /hotels/admin — OWNER → 403")
        void owner_cannotViewAdminList() throws Exception {
            mockMvc.perform(get("/hotels/admin")
                            .with(withRole("owner@test.com", "OWNER")))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /hotels/admin — USER → 403")
        void user_cannotViewAdminList() throws Exception {
            mockMvc.perform(get("/hotels/admin")
                            .with(withRole("user@test.com", "USER")))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("GET /hotels/admin — ADMIN → 200")
        void admin_canViewAdminList() throws Exception {
            when(hotelService.getAllHotelsAdmin(any(), anyInt(), anyInt())).thenReturn(null);

            mockMvc.perform(get("/hotels/admin")
                            .with(withRole("admin@test.com", "ADMIN")))
                    .andExpect(status().isOk());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /bookings/{id}/reject — same OWNER/STAFF guard
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("PATCH /bookings/{id}/reject — OWNER/STAFF guard")
    class BookingRejectAuth {

        @Test
        @DisplayName("USER → 403")
        void user_cannotRejectBooking() throws Exception {
            mockMvc.perform(patch("/bookings/bk-1/reject")
                            .with(withRole("user@test.com", "USER"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"reason\":\"test\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("OWNER → 200")
        void owner_canRejectBooking() throws Exception {
            when(bookingService.rejectBooking(anyString(), anyString(), any())).thenReturn(null);

            mockMvc.perform(patch("/bookings/bk-1/reject")
                            .with(withRole("owner@test.com", "OWNER"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"reason\":\"not available\"}"))
                    .andExpect(status().isOk());
        }
    }
}
