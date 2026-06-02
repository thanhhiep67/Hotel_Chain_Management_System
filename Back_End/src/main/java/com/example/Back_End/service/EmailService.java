package com.example.Back_End.service;

import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("EEEE, dd/MM/yyyy", new Locale("vi"));

    /* ── OTP ── */
    public void sendOtpEmail(String toEmail, String otp) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject("Mã OTP đặt lại mật khẩu - Hotel Chain");
        message.setText(
                "Mã OTP của bạn là: " + otp + "\n\n" +
                "Mã có hiệu lực trong 5 phút.\n" +
                "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này."
        );
        mailSender.send(message);
    }

    /* ── Booking confirmed ── */
    @Async
    public void sendBookingConfirmedEmail(User user, Booking booking, Room room, Hotel hotel) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(user.getEmail());
            helper.setSubject("✅ Xác nhận đặt phòng #" + booking.getId().substring(0, 8).toUpperCase() + " - Hotel Chain");
            helper.setText(buildConfirmHtml(user, booking, room, hotel), true);
            mailSender.send(mime);
        } catch (MessagingException e) {
            log.error("[Email] Failed to send booking confirmation to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    /* ── HTML builder ── */
    private String buildConfirmHtml(User user, Booking booking, Room room, Hotel hotel) {
        long nights = ChronoUnit.DAYS.between(booking.getCheckIn(), booking.getCheckOut());
        String roomType = room != null ? formatRoomType(room.getType().name()) : "—";
        String roomNum  = room != null ? room.getRoomNumber() : "—";
        String totalFmt = String.format("%,.0f₫", booking.getTotalPrice());
        String priceFmt = room != null ? String.format("%,.0f₫/đêm", room.getPricePerNight()) : "";

        String specialRow = (booking.getSpecialRequests() != null && !booking.getSpecialRequests().isBlank())
                ? row("Yêu cầu đặc biệt", booking.getSpecialRequests())
                : "";

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
                  <table width="100%%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding:32px 16px">
                      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%">

                        <!-- Header -->
                        <tr><td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center">
                          <p style="margin:0 0 4px;font-size:13px;color:#93c5fd;letter-spacing:2px;text-transform:uppercase">Hotel Chain</p>
                          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff">Đặt phòng đã được xác nhận</h1>
                          <p style="margin:12px 0 0;font-size:14px;color:#bfdbfe">Cảm ơn bạn đã tin tưởng Hotel Chain</p>
                        </td></tr>

                        <!-- Badge -->
                        <tr><td style="background:#ffffff;padding:28px 40px 8px;text-align:center">
                          <span style="display:inline-block;background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0;
                            border-radius:100px;padding:6px 20px;font-size:13px;font-weight:600">
                            ✅ Xác nhận thành công
                          </span>
                          <p style="margin:16px 0 0;font-size:15px;color:#374151">
                            Xin chào <strong>%s</strong>, đặt phòng của bạn đã được xác nhận!
                          </p>
                        </td></tr>

                        <!-- Booking details -->
                        <tr><td style="background:#ffffff;padding:24px 40px">
                          <table width="100%%" cellpadding="0" cellspacing="0"
                            style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
                            <tr><td colspan="2"
                              style="background:#f8fafc;padding:14px 20px;font-size:13px;font-weight:700;
                                color:#6b7280;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e5e7eb">
                              Chi tiết đặt phòng
                            </td></tr>
                            %s%s%s%s%s%s%s%s%s
                          </table>
                        </td></tr>

                        <!-- Note -->
                        <tr><td style="background:#ffffff;padding:8px 40px 28px">
                          <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:8px;padding:14px 18px">
                            <p style="margin:0;font-size:13px;color:#1d4ed8;line-height:1.6">
                              📋 Vui lòng xuất trình email này hoặc mã booking khi nhận phòng.<br>
                              📞 Liên hệ khách sạn nếu cần hỗ trợ thêm.
                            </p>
                          </div>
                        </td></tr>

                        <!-- Footer -->
                        <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;
                          border-top:1px solid #e5e7eb">
                          <p style="margin:0;font-size:12px;color:#9ca3af">
                            © 2025 Hotel Chain · Email này được gửi tự động, vui lòng không reply.
                          </p>
                        </td></tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(
                user.getFullName(),
                row("Mã booking",     "#" + booking.getId().substring(0, 8).toUpperCase()),
                row("Khách sạn",      hotel != null ? hotel.getName() : "—"),
                row("Địa chỉ",        hotel != null ? hotel.getAddress() + ", " + hotel.getCity() : "—"),
                row("Phòng",          roomNum + " · " + roomType),
                row("Nhận phòng",     booking.getCheckIn().format(DATE_FMT)),
                row("Trả phòng",      booking.getCheckOut().format(DATE_FMT)),
                row("Số đêm / Khách", nights + " đêm · " + booking.getGuestCount() + " khách"),
                row("Tổng tiền",      "<strong style='color:#2563eb;font-size:16px'>" + totalFmt + "</strong>"
                                      + (priceFmt.isEmpty() ? "" : " <span style='color:#9ca3af;font-size:12px'>(" + priceFmt + ")</span>")),
                specialRow
        );
    }

    /* ── Payment confirmation ── */
    @Async
    public void sendPaymentConfirmEmail(User user, Booking booking, Room room, Hotel hotel) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(user.getEmail());
            helper.setSubject("💳 Xác nhận thanh toán #"
                    + booking.getId().substring(0, 8).toUpperCase() + " - Hotel Chain");
            helper.setText(buildPaymentConfirmHtml(user, booking, room, hotel), true);
            mailSender.send(mime);
        } catch (MessagingException e) {
            log.error("[Email] Failed to send payment confirmation to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    private String buildPaymentConfirmHtml(User user, Booking booking, Room room, Hotel hotel) {
        long nights      = ChronoUnit.DAYS.between(booking.getCheckIn(), booking.getCheckOut());
        String roomNum   = room  != null ? room.getRoomNumber()                  : "—";
        String roomType  = room  != null ? formatRoomType(room.getType().name()) : "—";
        String hotelName = hotel != null ? hotel.getName()                       : "Hotel Chain";
        String hotelAddr = hotel != null ? hotel.getAddress() + ", " + hotel.getCity() : "—";
        String totalFmt  = String.format("%,.0f₫", booking.getTotalPrice());
        String origFmt   = String.format("%,.0f₫", booking.getOriginalPrice() != null ? booking.getOriginalPrice() : booking.getTotalPrice());
        String paidAt    = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm · dd/MM/yyyy"));

        String discountRow = (booking.getDiscountAmount() != null && booking.getDiscountAmount() > 0)
                ? row("Giảm giá", "<span style='color:#16a34a'>− "
                        + String.format("%,.0f₫", booking.getDiscountAmount()) + "</span>")
                : "";

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
                  <table width="100%%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding:32px 16px">
                      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%">

                        <!-- Header -->
                        <tr><td style="background:linear-gradient(135deg,#312e81,#6366f1);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center">
                          <p style="margin:0 0 4px;font-size:13px;color:#c7d2fe;letter-spacing:2px;text-transform:uppercase">Hotel Chain</p>
                          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff">Thanh toán thành công!</h1>
                          <p style="margin:12px 0 0;font-size:14px;color:#e0e7ff">Giao dịch của bạn đã được xử lý</p>
                        </td></tr>

                        <!-- Amount -->
                        <tr><td style="background:#ffffff;padding:32px 40px 8px;text-align:center">
                          <p style="margin:0 0 4px;font-size:13px;color:#6b7280">Số tiền đã thanh toán</p>
                          <p style="margin:0;font-size:40px;font-weight:800;color:#4f46e5;letter-spacing:-1px">%s</p>
                          <p style="margin:8px 0 0;font-size:12px;color:#9ca3af">%s</p>
                        </td></tr>

                        <!-- Status badge -->
                        <tr><td style="background:#ffffff;padding:12px 40px 8px;text-align:center">
                          <span style="display:inline-block;background:#ede9fe;color:#5b21b6;border:1px solid #ddd6fe;
                            border-radius:100px;padding:6px 20px;font-size:13px;font-weight:600">
                            💳 Đã thanh toán
                          </span>
                          <p style="margin:14px 0 0;font-size:15px;color:#374151">
                            Xin chào <strong>%s</strong>, cảm ơn bạn đã thanh toán!
                          </p>
                        </td></tr>

                        <!-- Booking details -->
                        <tr><td style="background:#ffffff;padding:24px 40px">
                          <table width="100%%" cellpadding="0" cellspacing="0"
                            style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
                            <tr><td colspan="2"
                              style="background:#f5f3ff;padding:14px 20px;font-size:13px;font-weight:700;
                                color:#5b21b6;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #ddd6fe">
                              Chi tiết đặt phòng
                            </td></tr>
                            %s%s%s%s%s%s%s%s
                          </table>
                        </td></tr>

                        <!-- Note -->
                        <tr><td style="background:#ffffff;padding:8px 40px 28px">
                          <div style="background:#f5f3ff;border-left:4px solid #6366f1;border-radius:8px;padding:14px 18px">
                            <p style="margin:0;font-size:13px;color:#4338ca;line-height:1.6">
                              📋 Lưu email này làm bằng chứng thanh toán.<br>
                              📱 Mã QR nhận phòng có trong ứng dụng sau khi booking được xác nhận.
                            </p>
                          </div>
                        </td></tr>

                        <!-- Footer -->
                        <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;
                          border-top:1px solid #e5e7eb">
                          <p style="margin:0;font-size:12px;color:#9ca3af">
                            © 2025 Hotel Chain · Email này được gửi tự động, vui lòng không reply.
                          </p>
                        </td></tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(
                totalFmt,
                paidAt,
                user.getFullName(),
                row("Mã booking",    "#" + booking.getId().substring(0, 8).toUpperCase()),
                row("Khách sạn",     hotelName),
                row("Địa chỉ",       hotelAddr),
                row("Phòng",         roomNum + " · " + roomType),
                row("Nhận phòng",    booking.getCheckIn().format(DATE_FMT)),
                row("Trả phòng",     booking.getCheckOut().format(DATE_FMT)),
                row("Số đêm / Khách",nights + " đêm · " + booking.getGuestCount() + " khách"),
                discountRow.isEmpty()
                    ? row("Tổng thanh toán",
                          "<strong style='color:#4f46e5;font-size:16px'>" + totalFmt + "</strong>")
                    : row("Giá gốc", origFmt) + discountRow
                    + row("Tổng thanh toán",
                          "<strong style='color:#4f46e5;font-size:16px'>" + totalFmt + "</strong>")
        );
    }

    /* ── Check-in reminder ── */
    @Async
    public void sendCheckInReminderEmail(User user, Booking booking, Room room, Hotel hotel) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(user.getEmail());
            helper.setSubject("⏰ Nhắc nhở: Ngày mai bạn nhận phòng tại "
                    + (hotel != null ? hotel.getName() : "Hotel Chain") + "!");
            helper.setText(buildCheckInReminderHtml(user, booking, room, hotel), true);
            mailSender.send(mime);
        } catch (MessagingException e) {
            log.error("[Email] Failed to send check-in reminder to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    private String buildCheckInReminderHtml(User user, Booking booking, Room room, Hotel hotel) {
        long nights     = ChronoUnit.DAYS.between(booking.getCheckIn(), booking.getCheckOut());
        String roomNum  = room  != null ? room.getRoomNumber()                    : "—";
        String roomType = room  != null ? formatRoomType(room.getType().name())   : "—";
        String hotelName    = hotel != null ? hotel.getName()                     : "Hotel Chain";
        String hotelAddress = hotel != null ? hotel.getAddress() + ", " + hotel.getCity() : "—";
        String totalFmt = String.format("%,.0f₫", booking.getTotalPrice());

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
                  <table width="100%%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding:32px 16px">
                      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%">

                        <!-- Header -->
                        <tr><td style="background:linear-gradient(135deg,#92400e,#f59e0b);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center">
                          <p style="margin:0 0 4px;font-size:13px;color:#fde68a;letter-spacing:2px;text-transform:uppercase">Hotel Chain</p>
                          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff">Nhắc nhở nhận phòng ngày mai</h1>
                          <p style="margin:12px 0 0;font-size:14px;color:#fef3c7">Chúng tôi mong được đón tiếp bạn!</p>
                        </td></tr>

                        <!-- Greeting -->
                        <tr><td style="background:#ffffff;padding:28px 40px 8px;text-align:center">
                          <span style="font-size:40px">⏰</span>
                          <p style="margin:12px 0 0;font-size:15px;color:#374151">
                            Xin chào <strong>%s</strong>, ngày mai là ngày nhận phòng của bạn!
                          </p>
                          <p style="margin:8px 0 0;font-size:14px;color:#6b7280">
                            Hãy chuẩn bị sẵn sàng để có kỳ nghỉ thật thoải mái.
                          </p>
                        </td></tr>

                        <!-- Booking details -->
                        <tr><td style="background:#ffffff;padding:24px 40px">
                          <table width="100%%" cellpadding="0" cellspacing="0"
                            style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
                            <tr><td colspan="2"
                              style="background:#fffbeb;padding:14px 20px;font-size:13px;font-weight:700;
                                color:#92400e;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #fde68a">
                              Thông tin đặt phòng
                            </td></tr>
                            %s%s%s%s%s%s%s
                          </table>
                        </td></tr>

                        <!-- Tips -->
                        <tr><td style="background:#ffffff;padding:8px 40px 28px">
                          <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px">
                            <p style="margin:0 0 8px;font-size:13px;color:#92400e;font-weight:600">Chuẩn bị trước khi đến:</p>
                            <p style="margin:0;font-size:13px;color:#78350f;line-height:1.8">
                              🪪 Mang theo CMND/Hộ chiếu để làm thủ tục nhận phòng<br>
                              📱 Xuất trình mã QR hoặc mã booking trong ứng dụng<br>
                              🕐 Giờ nhận phòng tiêu chuẩn từ 14:00 (liên hệ khách sạn nếu cần nhận sớm)
                            </p>
                          </div>
                        </td></tr>

                        <!-- Footer -->
                        <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;
                          border-top:1px solid #e5e7eb">
                          <p style="margin:0;font-size:12px;color:#9ca3af">
                            © 2025 Hotel Chain · Email này được gửi tự động, vui lòng không reply.
                          </p>
                        </td></tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(
                user.getFullName(),
                row("Mã booking",     "#" + booking.getId().substring(0, 8).toUpperCase()),
                row("Khách sạn",      hotelName),
                row("Địa chỉ",        hotelAddress),
                row("Phòng",          roomNum + " · " + roomType),
                row("Nhận phòng",     "<strong style='color:#d97706'>" + booking.getCheckIn().format(DATE_FMT) + "</strong>"),
                row("Trả phòng",      booking.getCheckOut().format(DATE_FMT)),
                row("Số đêm / Tổng",  nights + " đêm · <strong style='color:#d97706'>" + totalFmt + "</strong>")
        );
    }

    /* ── Check-out review request ── */
    @Async
    public void sendCheckOutReviewEmail(User user, Booking booking, Room room, Hotel hotel) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(user.getEmail());
            helper.setSubject("⭐ Cảm ơn bạn đã lưu trú tại "
                    + (hotel != null ? hotel.getName() : "Hotel Chain") + "!");
            helper.setText(buildReviewHtml(user, booking, room, hotel), true);
            mailSender.send(mime);
        } catch (MessagingException e) {
            log.error("[Email] Failed to send review email to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    private String buildReviewHtml(User user, Booking booking, Room room, Hotel hotel) {
        long nights = ChronoUnit.DAYS.between(booking.getCheckIn(), booking.getCheckOut());
        String roomNum  = room  != null ? room.getRoomNumber()  : "—";
        String roomType = room  != null ? formatRoomType(room.getType().name()) : "—";
        String hotelName = hotel != null ? hotel.getName()  : "Hotel Chain";
        String totalFmt  = String.format("%,.0f₫", booking.getTotalPrice());

        return """
                <!DOCTYPE html>
                <html lang="vi">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
                <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e">
                  <table width="100%%" cellpadding="0" cellspacing="0">
                    <tr><td align="center" style="padding:32px 16px">
                      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%">

                        <!-- Header -->
                        <tr><td style="background:linear-gradient(135deg,#064e3b,#059669);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center">
                          <p style="margin:0 0 4px;font-size:13px;color:#a7f3d0;letter-spacing:2px;text-transform:uppercase">Hotel Chain</p>
                          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff">Cảm ơn bạn đã lưu trú!</h1>
                          <p style="margin:12px 0 0;font-size:14px;color:#d1fae5">Chúng tôi rất vui được đón tiếp bạn</p>
                        </td></tr>

                        <!-- Greeting -->
                        <tr><td style="background:#ffffff;padding:28px 40px 8px;text-align:center">
                          <span style="font-size:40px">⭐</span>
                          <p style="margin:12px 0 0;font-size:15px;color:#374151">
                            Xin chào <strong>%s</strong>, kỳ lưu trú của bạn tại <strong>%s</strong> đã kết thúc.
                          </p>
                          <p style="margin:8px 0 0;font-size:14px;color:#6b7280">
                            Ý kiến của bạn giúp chúng tôi cải thiện dịch vụ mỗi ngày.
                          </p>
                        </td></tr>

                        <!-- Stay summary -->
                        <tr><td style="background:#ffffff;padding:24px 40px">
                          <table width="100%%" cellpadding="0" cellspacing="0"
                            style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
                            <tr><td colspan="2"
                              style="background:#f8fafc;padding:14px 20px;font-size:13px;font-weight:700;
                                color:#6b7280;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e5e7eb">
                              Tóm tắt kỳ lưu trú
                            </td></tr>
                            %s%s%s%s%s
                          </table>
                        </td></tr>

                        <!-- CTA -->
                        <tr><td style="background:#ffffff;padding:8px 40px 28px;text-align:center">
                          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px">
                            <p style="margin:0 0 8px;font-size:14px;color:#065f46;font-weight:600">
                              Bạn có muốn chia sẻ trải nghiệm?
                            </p>
                            <p style="margin:0;font-size:13px;color:#047857;line-height:1.6">
                              📝 Hãy liên hệ lại với chúng tôi hoặc để lại đánh giá trên trang web.<br>
                              📞 Mọi góp ý đều được trân trọng và phản hồi trong 24h.
                            </p>
                          </div>
                        </td></tr>

                        <!-- Footer -->
                        <tr><td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;
                          border-top:1px solid #e5e7eb">
                          <p style="margin:0;font-size:12px;color:#9ca3af">
                            © 2025 Hotel Chain · Email này được gửi tự động, vui lòng không reply.
                          </p>
                        </td></tr>

                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(
                user.getFullName(), hotelName,
                row("Khách sạn",      hotelName),
                row("Phòng",          roomNum + " · " + roomType),
                row("Nhận phòng",     booking.getCheckIn().format(DATE_FMT)),
                row("Trả phòng",      booking.getCheckOut().format(DATE_FMT)),
                row("Số đêm / Tổng",  nights + " đêm · <strong style='color:#059669'>" + totalFmt + "</strong>")
        );
    }

    private static String row(String label, String value) {
        return """
                <tr style="border-bottom:1px solid #f3f4f6">
                  <td style="padding:12px 20px;font-size:13px;color:#6b7280;white-space:nowrap;width:160px">%s</td>
                  <td style="padding:12px 20px;font-size:14px;color:#111827;font-weight:500">%s</td>
                </tr>
                """.formatted(label, value);
    }

    private static String formatRoomType(String type) {
        return switch (type) {
            case "SINGLE" -> "Single";
            case "DOUBLE" -> "Double";
            case "TWIN"   -> "Twin";
            case "SUITE"  -> "Suite";
            case "DELUXE" -> "Deluxe";
            case "FAMILY" -> "Family";
            default       -> type;
        };
    }
}
