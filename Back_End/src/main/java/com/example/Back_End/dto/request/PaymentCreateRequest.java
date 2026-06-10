package com.example.Back_End.dto.request;

import com.example.Back_End.model.enums.PaymentMethod;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PaymentCreateRequest {
    private String bookingId;
    private PaymentMethod method;
    private String bankCode;  // VNPay only: chọn thẳng ngân hàng, null = hiển thị tất cả
    private String locale;    // "vn" | "en", null → mặc định "vn"
}
