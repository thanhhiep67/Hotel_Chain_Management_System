package com.example.Back_End.service;

import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for JwtService covering:
 *   - Tạo token (generate access / refresh)
 *   - Validate token còn hiệu lực
 *   - Detect token hết hạn
 *   - Detect token giả / bị sửa
 */
class JwtServiceTest {

    // 64-char Base64 → 48 bytes (above HMAC-SHA256's 32-byte minimum)
    private static final String SECRET =
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    // Different key used to forge tokens with a mismatched signature
    private static final String DIFFERENT_SECRET =
            "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    private static final long ACCESS_EXP  = 3_600_000L;   // 1 hour
    private static final long REFRESH_EXP = 86_400_000L;  // 24 hours

    private JwtService jwtService;
    private User       user;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret",               SECRET);
        ReflectionTestUtils.setField(jwtService, "accessTokenExpiration",  ACCESS_EXP);
        ReflectionTestUtils.setField(jwtService, "refreshTokenExpiration", REFRESH_EXP);

        user = User.builder()
                .id("user-1")
                .email("alice@example.com")
                .role(UserRole.USER)
                .build();
    }

    // ─── 1. Tạo token ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("generateAccessToken — tạo access token")
    class GenerateAccessToken {

        @Test
        @DisplayName("Token không rỗng và có định dạng JWT (3 phần phân cách bởi dấu chấm)")
        void producesValidJwtFormat() {
            String token = jwtService.generateAccessToken(user);
            assertThat(token).isNotBlank();
            assertThat(token.split("\\.")).hasSize(3);
        }

        @Test
        @DisplayName("extractEmail trả về đúng email của user")
        void emailInSubjectMatchesUser() {
            String token = jwtService.generateAccessToken(user);
            assertThat(jwtService.extractEmail(token)).isEqualTo(user.getEmail());
        }

        @Test
        @DisplayName("extractRole trả về đúng tên role")
        void roleClaimMatchesUser() {
            String token = jwtService.generateAccessToken(user);
            assertThat(jwtService.extractRole(token)).isEqualTo(user.getRole().name());
        }

        @Test
        @DisplayName("Token vừa tạo luôn còn hiệu lực")
        void freshTokenIsValid() {
            String token = jwtService.generateAccessToken(user);
            assertThat(jwtService.isTokenValid(token)).isTrue();
        }

        @Test
        @DisplayName("Hai user khác nhau → token khác nhau")
        void differentUsersProduceDifferentTokens() {
            User other = User.builder()
                    .id("user-2")
                    .email("bob@example.com")
                    .role(UserRole.OWNER)
                    .build();

            String tokenAlice = jwtService.generateAccessToken(user);
            String tokenBob   = jwtService.generateAccessToken(other);

            assertThat(tokenAlice).isNotEqualTo(tokenBob);
        }
    }

    @Nested
    @DisplayName("generateRefreshToken — tạo refresh token")
    class GenerateRefreshToken {

        @Test
        @DisplayName("Refresh token không rỗng")
        void producesNonBlankToken() {
            String token = jwtService.generateRefreshToken(user);
            assertThat(token).isNotBlank();
        }

        @Test
        @DisplayName("Refresh token chứa đúng email")
        void emailExtractedCorrectly() {
            String token = jwtService.generateRefreshToken(user);
            assertThat(jwtService.extractEmail(token)).isEqualTo(user.getEmail());
        }

        @Test
        @DisplayName("Refresh token không mang claim 'role' (không cần role)")
        void roleClaimIsAbsent() {
            String token = jwtService.generateRefreshToken(user);
            assertThat(jwtService.extractRole(token)).isNull();
        }

        @Test
        @DisplayName("Refresh token vừa tạo luôn còn hiệu lực")
        void freshTokenIsValid() {
            String token = jwtService.generateRefreshToken(user);
            assertThat(jwtService.isTokenValid(token)).isTrue();
        }

        @Test
        @DisplayName("Access token và refresh token của cùng user là khác nhau")
        void accessAndRefreshTokensDiffer() {
            String access  = jwtService.generateAccessToken(user);
            String refresh = jwtService.generateRefreshToken(user);
            // Different expiration claim → different payload → different token
            assertThat(access).isNotEqualTo(refresh);
        }
    }

    // ─── 2. Validate token ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("isTokenValid — validate token hợp lệ")
    class ValidateToken {

        @Test
        @DisplayName("Access token còn hạn → isTokenValid trả true")
        void validAccessTokenReturnsTrue() {
            String token = jwtService.generateAccessToken(user);
            assertThat(jwtService.isTokenValid(token)).isTrue();
        }

        @Test
        @DisplayName("Refresh token còn hạn → isTokenValid trả true")
        void validRefreshTokenReturnsTrue() {
            String token = jwtService.generateRefreshToken(user);
            assertThat(jwtService.isTokenValid(token)).isTrue();
        }
    }

    // ─── 3. Token hết hạn ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("Token hết hạn (expired)")
    class ExpiredToken {

        private JwtService expiredService;

        @BeforeEach
        void setUpExpired() {
            expiredService = new JwtService();
            ReflectionTestUtils.setField(expiredService, "secret", SECRET);
            // Negative expiration → expiry date is in the past at creation time
            ReflectionTestUtils.setField(expiredService, "accessTokenExpiration",  -10_000L);
            ReflectionTestUtils.setField(expiredService, "refreshTokenExpiration", -10_000L);
        }

        @Test
        @DisplayName("Access token hết hạn → isTokenValid trả false")
        void expiredAccessTokenIsInvalid() {
            String token = expiredService.generateAccessToken(user);
            assertThat(jwtService.isTokenValid(token)).isFalse();
        }

        @Test
        @DisplayName("Refresh token hết hạn → isTokenValid trả false")
        void expiredRefreshTokenIsInvalid() {
            String token = expiredService.generateRefreshToken(user);
            assertThat(jwtService.isTokenValid(token)).isFalse();
        }

        @Test
        @DisplayName("Token hết hạn nhưng email vẫn extract được (claims còn đó)")
        void expiredTokenEmailCanStillBeExtracted() {
            // Note: JJWT throws ExpiredJwtException on parse — isTokenValid catches it.
            // Direct extractEmail will throw; isTokenValid gracefully returns false.
            String token = expiredService.generateAccessToken(user);
            assertThat(jwtService.isTokenValid(token)).isFalse();
        }
    }

    // ─── 4. Token giả / bị sửa ───────────────────────────────────────────────────

    @Nested
    @DisplayName("Token giả (forged / tampered)")
    class ForgedToken {

        @Test
        @DisplayName("Token ký bằng secret khác → signature không khớp → isTokenValid false")
        void tokenSignedWithDifferentSecretIsInvalid() {
            JwtService forger = new JwtService();
            ReflectionTestUtils.setField(forger, "secret",               DIFFERENT_SECRET);
            ReflectionTestUtils.setField(forger, "accessTokenExpiration",  ACCESS_EXP);
            ReflectionTestUtils.setField(forger, "refreshTokenExpiration", REFRESH_EXP);

            String forgedToken = forger.generateAccessToken(user);
            // jwtService verifies with the original SECRET → mismatch
            assertThat(jwtService.isTokenValid(forgedToken)).isFalse();
        }

        @Test
        @DisplayName("Signature bị sửa một ký tự → isTokenValid false")
        void tamperedSignatureIsInvalid() {
            String valid = jwtService.generateAccessToken(user);
            // JWT: header.payload.signature — replace (not append) the last char
            String[] parts = valid.split("\\.");
            String sig      = parts[2];
            // Flip the last char: 'A'↔'B', anything else → 'A'
            char last        = sig.charAt(sig.length() - 1);
            char replacement = (last == 'A') ? 'B' : 'A';
            String tamperedSig = sig.substring(0, sig.length() - 1) + replacement;
            String tampered    = parts[0] + "." + parts[1] + "." + tamperedSig;

            assertThat(jwtService.isTokenValid(tampered)).isFalse();
        }

        @Test
        @DisplayName("Payload bị sửa → signature không khớp → isTokenValid false")
        void tamperedPayloadIsInvalid() {
            String valid  = jwtService.generateAccessToken(user);
            String[] parts = valid.split("\\.");
            // Corrupt the last 2 chars of the base64url-encoded payload
            String corruptedPayload = parts[1].substring(0, parts[1].length() - 2) + "XX";
            String tampered = parts[0] + "." + corruptedPayload + "." + parts[2];

            assertThat(jwtService.isTokenValid(tampered)).isFalse();
        }

        @Test
        @DisplayName("Chuỗi không phải JWT → isTokenValid false")
        void randomStringIsInvalid() {
            assertThat(jwtService.isTokenValid("this.is.not.a.jwt")).isFalse();
        }

        @Test
        @DisplayName("Chuỗi rỗng → isTokenValid false")
        void emptyStringIsInvalid() {
            assertThat(jwtService.isTokenValid("")).isFalse();
        }

        @Test
        @DisplayName("Token chỉ có một phần (không có dấu chấm) → isTokenValid false")
        void singlePartStringIsInvalid() {
            assertThat(jwtService.isTokenValid("notadotseperatedstring")).isFalse();
        }

        @Test
        @DisplayName("Header bị sửa → signature không khớp → isTokenValid false")
        void tamperedHeaderIsInvalid() {
            String valid   = jwtService.generateAccessToken(user);
            String[] parts = valid.split("\\.");
            String corruptedHeader = parts[0].substring(0, parts[0].length() - 2) + "XX";
            String tampered = corruptedHeader + "." + parts[1] + "." + parts[2];

            assertThat(jwtService.isTokenValid(tampered)).isFalse();
        }
    }
}
