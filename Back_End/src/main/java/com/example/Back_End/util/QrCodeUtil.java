package com.example.Back_End.util;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;

public final class QrCodeUtil {

    private QrCodeUtil() {}

    /**
     * Encode {@code content} as a QR code and return a PNG byte array.
     * ErrorCorrectionLevel.M (≈15% recovery) balances size vs robustness for on-screen scanning.
     */
    public static byte[] generatePng(String content, int sizePx) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            Map<EncodeHintType, Object> hints = Map.of(
                    EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                    EncodeHintType.MARGIN, 2
            );
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (WriterException | IOException e) {
            throw new RuntimeException("QR code generation failed", e);
        }
    }
}
