package com.example.Back_End.service;

import com.example.Back_End.config.VNPayProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VNPayService {

    private static final DateTimeFormatter VNPAY_DATE_FMT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final VNPayProperties props;
    // RestClient không cần inject — stateless, tạo một lần là dùng mãi
    private final RestClient restClient = RestClient.create();

    /**
     * Build a VNPay payment URL for the given transaction.
     *
     * @param txnRef    unique reference — we use the Payment document ID
     * @param amount    booking total in VND (whole number)
     * @param orderInfo short ASCII description (no special chars)
     * @param ipAddr    client IP
     * @param locale    "vn" or "en"
     * @param bankCode  optional direct-bank code (null = let user choose on VNPay page)
     */
    public String buildPaymentUrl(String txnRef, long amount,
                                   String orderInfo, String ipAddr,
                                   String locale, String bankCode) {
        LocalDateTime now = LocalDateTime.now(VN_ZONE);

        Map<String, String> params = new TreeMap<>();
        params.put("vnp_Version",    "2.1.0");
        params.put("vnp_Command",    "pay");
        params.put("vnp_TmnCode",    props.getTmnCode());
        params.put("vnp_Amount",     String.valueOf(amount * 100));   // VNPay unit = 1/100 VND
        params.put("vnp_CurrCode",   "VND");
        params.put("vnp_TxnRef",     txnRef);
        params.put("vnp_OrderInfo",  orderInfo);
        params.put("vnp_OrderType",  "other");
        params.put("vnp_Locale",     locale != null ? locale : "vn");
        params.put("vnp_ReturnUrl",  props.getReturnUrl());
        params.put("vnp_IpAddr",     ipAddr);
        params.put("vnp_CreateDate", now.format(VNPAY_DATE_FMT));
        params.put("vnp_ExpireDate", now.plusMinutes(15).format(VNPAY_DATE_FMT));

        if (bankCode != null && !bankCode.isBlank()) {
            params.put("vnp_BankCode", bankCode);
        }

        String hashData  = buildHashData(params);
        String secureHash = hmacSHA512(props.getHashSecret(), hashData);

        return props.getPayUrl()
                + "?" + buildQueryString(params)
                + "&vnp_SecureHash=" + secureHash;
    }

    /**
     * Verify the HMAC-SHA512 signature on a VNPay callback.
     * <p>Mutates {@code params} — pass a copy from the controller.</p>
     */
    public boolean verifySignature(Map<String, String> params) {
        String received = params.remove("vnp_SecureHash");
        params.remove("vnp_SecureHashType");

        if (received == null || received.isBlank()) return false;

        Map<String, String> sorted = new TreeMap<>(params);
        String expected = hmacSHA512(props.getHashSecret(), buildHashData(sorted));
        return expected.equalsIgnoreCase(received);
    }

    // ── refund ────────────────────────────────────────────────────────────────

    /**
     * Call VNPay refund API (full refund).
     * Hash format for refund uses "|" pipe separator — different from payment URL.
     *
     * @param txnRef          Payment document ID (= original vnp_TxnRef)
     * @param amount          booking total in VND (whole number, NOT ×100)
     * @param transactionNo   vnp_TransactionNo received during callback
     * @param transactionDate original payment createdAt formatted yyyyMMddHHmmss
     * @param createBy        email / identifier of who triggered the refund
     * @param ipAddr          requester IP
     * @param orderInfo       refund reason description
     * @return parsed response body from VNPay (contains vnp_ResponseCode)
     */
    public Map<String, Object> callRefundApi(String txnRef, long amount,
                                              String transactionNo, String transactionDate,
                                              String createBy, String ipAddr,
                                              String orderInfo) {
        String requestId  = UUID.randomUUID().toString().replace("-", "");
        String createDate = LocalDateTime.now(VN_ZONE).format(VNPAY_DATE_FMT);
        String amountStr  = String.valueOf(amount * 100);

        // VNPay refund hash: fields joined by "|" in this exact order
        String hashData = String.join("|",
                requestId, "2.1.0", "refund",
                props.getTmnCode(), "02",           // "02" = full refund
                txnRef, amountStr,
                transactionNo, transactionDate,
                createBy, createDate, ipAddr, orderInfo);

        String secureHash = hmacSHA512(props.getHashSecret(), hashData);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("vnp_RequestId",      requestId);
        body.put("vnp_Version",        "2.1.0");
        body.put("vnp_Command",        "refund");
        body.put("vnp_TmnCode",        props.getTmnCode());
        body.put("vnp_TransactionType","02");
        body.put("vnp_TxnRef",         txnRef);
        body.put("vnp_Amount",         amountStr);
        body.put("vnp_OrderInfo",      orderInfo);
        body.put("vnp_TransactionNo",  transactionNo);
        body.put("vnp_TransactionDate",transactionDate);
        body.put("vnp_CreateBy",       createBy);
        body.put("vnp_CreateDate",     createDate);
        body.put("vnp_IpAddr",         ipAddr);
        body.put("vnp_SecureHash",     secureHash);

        return restClient.post()
                .uri(props.getApiUrl())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
    }

    // ── private helpers ───────────────────────────────────────────────────────

    /**
     * key=URLEncode(value, UTF-8) joined by "&" — used as HMAC input.
     * Must match exactly how VNPay computes the hash on their side.
     */
    private String buildHashData(Map<String, String> params) {
        return params.entrySet().stream()
                .filter(e -> e.getValue() != null && !e.getValue().isEmpty())
                .map(e -> e.getKey() + "="
                        + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    /** Full URL query string — same encoding as hash data. */
    private String buildQueryString(Map<String, String> params) {
        return params.entrySet().stream()
                .filter(e -> e.getValue() != null && !e.getValue().isEmpty())
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8)
                        + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }

    public String hmacSHA512(String key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(
                    key.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("HMAC-SHA512 failed", e);
        }
    }
}
