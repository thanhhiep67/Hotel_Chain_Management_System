package com.example.Back_End.service;

import com.example.Back_End.config.VNPayProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

/**
 * Unit tests for payment gateway HMAC signature verification.
 *
 * VNPay  — HMAC-SHA512  (actual implementation in VNPayService)
 * MoMo   — HMAC-SHA256  (reference implementation — MoMo chưa tích hợp vào codebase)
 *
 * Algorithm differences:
 *   VNPay : HMAC-SHA512, params sorted alphabetically, values URLEncoded, joined by "&"
 *   MoMo  : HMAC-SHA256, params sorted alphabetically, raw values (no URL-encoding), joined by "&"
 */
@ExtendWith(MockitoExtension.class)
class PaymentCallbackVerifyTest {

    private static final String VNPAY_SECRET = "test-secret-for-vnpay-unit-testing";

    @Mock VNPayProperties  props;
    @InjectMocks VNPayService vnPayService;

    // ─── Private helpers ─────────────────────────────────────────────────────────

    /**
     * Replicates VNPayService.buildHashData() — private method.
     * Keys sorted alphabetically (TreeMap), values URLEncoded, joined by "&".
     */
    private static String vnPayHashData(Map<String, String> params) {
        return new TreeMap<>(params).entrySet().stream()
                .filter(e -> e.getValue() != null && !e.getValue().isEmpty())
                .map(e -> e.getKey() + "=" +
                        URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    /** MoMo raw signature string: sorted alphabetical, raw values, no URL encoding. */
    private static String momoRawSignature(Map<String, String> params) {
        return params.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&"));
    }

    /** Pure Java HMAC-SHA256 — mirrors what a MoMo SDK would do internally. */
    private static String hmacSHA256(String key, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(raw.length * 2);
        for (byte b : raw) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static boolean verifyMoMo(Map<String, String> payload,
                                       String received, String secretKey) throws Exception {
        String expected = hmacSHA256(secretKey, momoRawSignature(payload));
        return expected.equalsIgnoreCase(received);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. VNPay — HMAC-SHA512 engine
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("VNPay — hmacSHA512() engine")
    class VNPayEngine {

        @Test
        @DisplayName("Output là 128 ký tự hex lowercase (512-bit digest)")
        void outputIs128CharLowercaseHex() {
            String hash = vnPayService.hmacSHA512(VNPAY_SECRET, "some-data");
            assertThat(hash)
                    .hasSize(128)
                    .matches("[0-9a-f]+");
        }

        @Test
        @DisplayName("Deterministic: cùng key + data → cùng hash")
        void sameInputAlwaysProducesSameOutput() {
            String h1 = vnPayService.hmacSHA512(VNPAY_SECRET, "hello");
            String h2 = vnPayService.hmacSHA512(VNPAY_SECRET, "hello");
            assertThat(h1).isEqualTo(h2);
        }

        @Test
        @DisplayName("Key khác → hash khác (avalanche effect)")
        void differentKeyDifferentHash() {
            String h1 = vnPayService.hmacSHA512("key-A", "same-data");
            String h2 = vnPayService.hmacSHA512("key-B", "same-data");
            assertThat(h1).isNotEqualTo(h2);
        }

        @Test
        @DisplayName("Data khác → hash khác")
        void differentDataDifferentHash() {
            String h1 = vnPayService.hmacSHA512(VNPAY_SECRET, "data-A");
            String h2 = vnPayService.hmacSHA512(VNPAY_SECRET, "data-B");
            assertThat(h1).isNotEqualTo(h2);
        }

        @Test
        @DisplayName("Data rỗng không crash — vẫn trả 128 ký tự hex")
        void emptyDataDoesNotCrash() {
            String hash = vnPayService.hmacSHA512(VNPAY_SECRET, "");
            assertThat(hash).hasSize(128);
        }

        @Test
        @DisplayName("Known vector: HMAC-SHA512 of 'The quick brown fox' with key 'key'")
        void knownTestVector() {
            // Pre-computed reference value (OpenSSL / RFC-4231 test vector)
            String key  = "key";
            String data = "The quick brown fox jumps over the lazy dog";
            String hash = vnPayService.hmacSHA512(key, data);
            assertThat(hash).isEqualToIgnoringCase(
                    "b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb" +
                    "82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. VNPay — verifySignature() callback check
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("VNPay — verifySignature() callback")
    class VNPayVerifySignature {

        @BeforeEach
        void stubSecret() {
            // lenient: some tests return false before reaching props.getHashSecret()
            // (null/blank SecureHash check happens before HMAC is computed)
            lenient().when(props.getHashSecret()).thenReturn(VNPAY_SECRET);
        }

        /** Builds a realistic VNPay IPN param map with a correctly signed hash. */
        private Map<String, String> signedParams() {
            Map<String, String> p = new HashMap<>();
            p.put("vnp_TxnRef",       "PAY-0001");
            p.put("vnp_ResponseCode", "00");
            p.put("vnp_Amount",       "50000000");
            p.put("vnp_OrderInfo",    "Thanh+toan+booking");
            p.put("vnp_BankCode",     "VCB");
            p.put("vnp_TransactionNo","VNP99887766");
            p.put("vnp_PayDate",      "20250701143000");
            // Compute correct signature over these 7 params (alphabetical, URLEncoded)
            String sig = vnPayService.hmacSHA512(VNPAY_SECRET, vnPayHashData(p));
            p.put("vnp_SecureHash", sig);
            return p;
        }

        // ── Đúng chữ ký ──────────────────────────────────────────────────────

        @Test
        @DisplayName("Đúng chữ ký → verifySignature trả true")
        void validSignature_returnsTrue() {
            assertThat(vnPayService.verifySignature(signedParams())).isTrue();
        }

        @Test
        @DisplayName("Hash viết hoa vẫn hợp lệ (equalsIgnoreCase)")
        void uppercaseHash_stillValid() {
            Map<String, String> p = signedParams();
            p.put("vnp_SecureHash", p.get("vnp_SecureHash").toUpperCase());
            assertThat(vnPayService.verifySignature(p)).isTrue();
        }

        @Test
        @DisplayName("vnp_SecureHashType có trong params → bị loại bỏ, không ảnh hưởng kết quả")
        void secureHashTypeParam_isIgnored() {
            Map<String, String> p = signedParams();
            p.put("vnp_SecureHashType", "HmacSHA512"); // extra field VNPay sometimes sends
            assertThat(vnPayService.verifySignature(p)).isTrue();
        }

        // ── Sai chữ ký ───────────────────────────────────────────────────────

        @Test
        @DisplayName("Thiếu vnp_SecureHash → trả false")
        void missingSecureHash_returnsFalse() {
            Map<String, String> p = new HashMap<>();
            p.put("vnp_TxnRef",       "PAY-0001");
            p.put("vnp_ResponseCode", "00");
            p.put("vnp_Amount",       "50000000");
            // vnp_SecureHash absent
            assertThat(vnPayService.verifySignature(p)).isFalse();
        }

        @Test
        @DisplayName("vnp_SecureHash rỗng → trả false")
        void emptySecureHash_returnsFalse() {
            Map<String, String> p = signedParams();
            p.put("vnp_SecureHash", "");
            assertThat(vnPayService.verifySignature(p)).isFalse();
        }

        @Test
        @DisplayName("Hash sai hoàn toàn → trả false")
        void wrongHash_returnsFalse() {
            Map<String, String> p = signedParams();
            p.put("vnp_SecureHash", "0".repeat(128));
            assertThat(vnPayService.verifySignature(p)).isFalse();
        }

        @Test
        @DisplayName("Hash đúng format nhưng sai giá trị (1 ký tự lệch) → trả false")
        void oneCharDifferentInHash_returnsFalse() {
            Map<String, String> p = signedParams();
            String original = p.get("vnp_SecureHash");
            // Flip last char: 'a'↔'b', anything else → 'a'
            char last = original.charAt(original.length() - 1);
            char flipped = (last == 'a') ? 'b' : 'a';
            p.put("vnp_SecureHash", original.substring(0, original.length() - 1) + flipped);
            assertThat(vnPayService.verifySignature(p)).isFalse();
        }

        @Test
        @DisplayName("vnp_Amount bị sửa sau khi ký (giả mạo số tiền) → trả false")
        void tamperedAmount_returnsFalse() {
            Map<String, String> p = signedParams();
            p.put("vnp_Amount", "100"); // attacker changes 500,000 VND → 1 VND
            assertThat(vnPayService.verifySignature(p)).isFalse();
        }

        @Test
        @DisplayName("vnp_ResponseCode bị sửa (01→00 để giả thành công) → trả false")
        void tamperedResponseCode_returnsFalse() {
            // Build params where responseCode = "01" (failed)
            Map<String, String> p = new HashMap<>();
            p.put("vnp_TxnRef",       "PAY-0002");
            p.put("vnp_ResponseCode", "01");           // failed
            p.put("vnp_Amount",       "50000000");
            p.put("vnp_TransactionNo","VNP00000000");
            String sig = vnPayService.hmacSHA512(VNPAY_SECRET, vnPayHashData(p));
            p.put("vnp_SecureHash", sig);

            // Attacker replaces "01" → "00" to forge a success
            p.put("vnp_ResponseCode", "00");
            assertThat(vnPayService.verifySignature(p)).isFalse();
        }

        @Test
        @DisplayName("Ký bằng secret khác → signature không khớp → trả false")
        void signedWithDifferentSecret_returnsFalse() {
            Map<String, String> p = new HashMap<>();
            p.put("vnp_TxnRef", "PAY-0003");
            p.put("vnp_Amount", "20000000");
            // Forge: sign with attacker's key
            String fakeHash = vnPayService.hmacSHA512("attacker-secret-key", vnPayHashData(p));
            p.put("vnp_SecureHash", fakeHash);
            // verifySignature verifies with VNPAY_SECRET (different) → false
            assertThat(vnPayService.verifySignature(p)).isFalse();
        }

        @Test
        @DisplayName("Chữ ký hợp lệ không thể tái sử dụng cho TxnRef khác (anti-replay)")
        void signatureNotReusableForDifferentTxn_returnsFalse() {
            Map<String, String> original = signedParams();
            String validHash = original.get("vnp_SecureHash");

            // Different transaction
            Map<String, String> replay = new HashMap<>(original);
            replay.put("vnp_TxnRef", "PAY-DIFFERENT");
            replay.put("vnp_SecureHash", validHash); // reuse original hash

            assertThat(vnPayService.verifySignature(replay)).isFalse();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. MoMo — HMAC-SHA256 reference implementation
    //    (MoMo chưa được tích hợp trong codebase — đây là reference để tích hợp sau)
    //    Ref: https://developers.momo.vn — IPN notification spec
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("MoMo — HMAC-SHA256 signature (reference implementation)")
    class MoMoVerifySignature {

        // Credentials from MoMo sandbox documentation
        private static final String SECRET_KEY = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
        private static final String ACCESS_KEY  = "F8BBA842ECF85";

        /** Simulates a MoMo IPN (Instant Payment Notification) callback payload. */
        private Map<String, String> ipnPayload(String resultCode) {
            Map<String, String> p = new HashMap<>();
            p.put("partnerCode",  "MOMO");
            p.put("accessKey",    ACCESS_KEY);
            p.put("requestId",    "REQ-001");
            p.put("orderId",      "ORDER-HOTEL-123");
            p.put("orderInfo",    "Thanh toan dat phong");
            p.put("amount",       "500000");
            p.put("transId",      "MOMO1234567890");
            p.put("resultCode",   resultCode);
            p.put("message",      resultCode.equals("0") ? "Successful." : "Failed");
            p.put("payType",      "qr");
            p.put("responseTime", "1720000000000");
            p.put("extraData",    "");
            return p;
        }

        @Test
        @DisplayName("HMAC-SHA256 output: 64 ký tự hex lowercase (256-bit digest)")
        void outputIs64CharLowercaseHex() throws Exception {
            String hash = hmacSHA256(SECRET_KEY, "any-data");
            assertThat(hash)
                    .hasSize(64)
                    .matches("[0-9a-f]+");
        }

        // ── Đúng chữ ký ──────────────────────────────────────────────────────

        @Test
        @DisplayName("Đúng chữ ký MoMo (resultCode=0) → verify trả true")
        void validSuccessSignature_returnsTrue() throws Exception {
            Map<String, String> payload = ipnPayload("0");
            String rawSig = momoRawSignature(payload);
            String sig    = hmacSHA256(SECRET_KEY, rawSig);

            assertThat(verifyMoMo(payload, sig, SECRET_KEY)).isTrue();
        }

        @Test
        @DisplayName("Đúng chữ ký MoMo (resultCode=1006 — thất bại) → verify trả true")
        void validFailedSignature_returnsTrue() throws Exception {
            Map<String, String> payload = ipnPayload("1006");
            String sig = hmacSHA256(SECRET_KEY, momoRawSignature(payload));

            assertThat(verifyMoMo(payload, sig, SECRET_KEY)).isTrue();
        }

        @Test
        @DisplayName("Hash viết hoa vẫn hợp lệ (equalsIgnoreCase)")
        void uppercaseSignature_stillValid() throws Exception {
            Map<String, String> payload = ipnPayload("0");
            String sig = hmacSHA256(SECRET_KEY, momoRawSignature(payload)).toUpperCase();

            assertThat(verifyMoMo(payload, sig, SECRET_KEY)).isTrue();
        }

        // ── Sai / bị sửa chữ ký ──────────────────────────────────────────────

        @Test
        @DisplayName("Sai chữ ký (hash giả) → trả false")
        void wrongSignature_returnsFalse() throws Exception {
            Map<String, String> payload = ipnPayload("0");
            assertThat(verifyMoMo(payload, "a".repeat(64), SECRET_KEY)).isFalse();
        }

        @Test
        @DisplayName("amount bị sửa sau khi ký (500000→1) → trả false")
        void tamperedAmount_returnsFalse() throws Exception {
            Map<String, String> payload = ipnPayload("0");
            String sig = hmacSHA256(SECRET_KEY, momoRawSignature(payload));

            payload.put("amount", "1"); // attacker lowers amount
            assertThat(verifyMoMo(payload, sig, SECRET_KEY)).isFalse();
        }

        @Test
        @DisplayName("resultCode bị sửa (1006→0 để giả thành công) → trả false")
        void tamperedResultCode_returnsFalse() throws Exception {
            Map<String, String> payload = ipnPayload("1006"); // originally failed
            String sig = hmacSHA256(SECRET_KEY, momoRawSignature(payload));

            payload.put("resultCode", "0"); // forged: attacker claims success
            assertThat(verifyMoMo(payload, sig, SECRET_KEY)).isFalse();
        }

        @Test
        @DisplayName("transId bị sửa → trả false")
        void tamperedTransId_returnsFalse() throws Exception {
            Map<String, String> payload = ipnPayload("0");
            String sig = hmacSHA256(SECRET_KEY, momoRawSignature(payload));

            payload.put("transId", "FAKE-TX-99"); // tampered transaction ID
            assertThat(verifyMoMo(payload, sig, SECRET_KEY)).isFalse();
        }

        @Test
        @DisplayName("Ký bằng secretKey khác → trả false")
        void signedWithDifferentSecret_returnsFalse() throws Exception {
            Map<String, String> payload = ipnPayload("0");
            // Attacker uses their own key to sign
            String forgedSig = hmacSHA256("attacker-key", momoRawSignature(payload));

            // Merchant verifies with real key → mismatch
            assertThat(verifyMoMo(payload, forgedSig, SECRET_KEY)).isFalse();
        }

        @Test
        @DisplayName("Chữ ký của orderId khác không thể tái sử dụng (anti-replay)")
        void signatureNotReusableForDifferentOrder_returnsFalse() throws Exception {
            Map<String, String> payload1 = ipnPayload("0");
            String sig = hmacSHA256(SECRET_KEY, momoRawSignature(payload1));

            // Different order, same signature
            Map<String, String> payload2 = ipnPayload("0");
            payload2.put("orderId", "ORDER-HOTEL-DIFFERENT");

            assertThat(verifyMoMo(payload2, sig, SECRET_KEY)).isFalse();
        }

        @Test
        @DisplayName("Thêm field mới vào payload → raw string thay đổi → trả false")
        void extraFieldInPayload_returnsFalse() throws Exception {
            Map<String, String> payload = ipnPayload("0");
            String sig = hmacSHA256(SECRET_KEY, momoRawSignature(payload));

            // Attacker injects an extra field after signing
            payload.put("injectedField", "malicious");
            assertThat(verifyMoMo(payload, sig, SECRET_KEY)).isFalse();
        }
    }
}
