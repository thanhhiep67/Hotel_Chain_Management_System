package com.example.Back_End.service;

import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Discount;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.enums.PaymentStatus;
import com.example.Back_End.repository.DiscountRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.data.mongodb.core.aggregation.Fields;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final HotelRepository    hotelRepository;
    private final RoomRepository     roomRepository;
    private final DiscountRepository discountRepository;
    private final UserRepository     userRepository;
    private final MongoTemplate      mongoTemplate;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // ── Xác thực quyền sở hữu ─────────────────────────────────────────────

    private Hotel getHotelForOwner(String ownerEmail, String hotelId) {
        String ownerId = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND)).getId();
        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));
        if (!hotel.getOwnerId().equals(ownerId))
            throw new AppException(ErrorCode.HOTEL_NOT_OWNED);
        return hotel;
    }

    // ── Export .xlsx ──────────────────────────────────────────────────────

    public byte[] exportExcel(String ownerEmail, String hotelId,
                               LocalDate from, LocalDate to) {
        Hotel hotel = getHotelForOwner(ownerEmail, hotelId);

        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt   = to.atTime(23, 59, 59);

        // Fetch dữ liệu thô
        List<Booking> bookings = mongoTemplate.find(
                Query.query(Criteria.where("hotelId").is(hotelId)
                        .and("createdAt").gte(fromDt).lte(toDt)),
                Booking.class);

        // Batch fetch room + discount info
        List<String> roomIds = bookings.stream()
                .map(Booking::getRoomId).distinct().collect(Collectors.toList());
        Map<String, Room> roomMap = roomRepository.findAllById(roomIds).stream()
                .collect(Collectors.toMap(Room::getId, r -> r));

        List<String> discountIds = bookings.stream()
                .filter(b -> b.getDiscountId() != null)
                .map(Booking::getDiscountId).distinct().collect(Collectors.toList());
        Map<String, Discount> discountMap = discountRepository.findAllById(discountIds).stream()
                .collect(Collectors.toMap(Discount::getId, d -> d));

        // Monthly revenue aggregation (reuse for Sheet 2)
        Aggregation revenueAgg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("hotelId").is(hotelId)
                        .and("paymentStatus").is(PaymentStatus.PAID.name())
                        .and("createdAt").gte(fromDt).lte(toDt)),
                Aggregation.project()
                        .and(DateOperators.Year.yearOf("createdAt")).as("year")
                        .and(DateOperators.Month.monthOf("createdAt")).as("month")
                        .and("totalPrice").as("totalPrice"),
                Aggregation.group(Fields.from(Fields.field("year"), Fields.field("month")))
                        .sum("totalPrice").as("revenue").count().as("count"),
                Aggregation.sort(Sort.by("_id.year", "_id.month"))
        );
        List<Document> monthlyRevenue = mongoTemplate
                .aggregate(revenueAgg, "bookings", Document.class).getMappedResults();

        // Discount stats aggregation (reuse for Sheet 3)
        Aggregation discountAgg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("hotelId").is(hotelId)
                        .and("discountId").ne(null)
                        .and("createdAt").gte(fromDt).lte(toDt)),
                Aggregation.group("discountId")
                        .count().as("usageCount")
                        .sum("discountAmount").as("totalDiscount"),
                Aggregation.sort(Sort.by(Sort.Direction.DESC, "usageCount"))
        );
        List<Document> discountDocs = mongoTemplate
                .aggregate(discountAgg, "bookings", Document.class).getMappedResults();

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle titleStyle   = buildTitleStyle(wb);
            CellStyle headerStyle  = buildHeaderStyle(wb);
            CellStyle currencyStyle = buildCurrencyStyle(wb);
            CellStyle dateStyle    = buildDateStyle(wb);

            writeBookingsSheet(wb, "Đặt phòng", bookings, roomMap,
                    titleStyle, headerStyle, currencyStyle, dateStyle, hotel.getName(), from, to);
            writeRevenueSheet(wb, "Doanh thu tháng", monthlyRevenue,
                    titleStyle, headerStyle, currencyStyle);
            writeDiscountSheet(wb, "Mã giảm giá", discountDocs, discountMap,
                    titleStyle, headerStyle, currencyStyle);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    // ── Sheet 1: Đặt phòng ────────────────────────────────────────────────

    private void writeBookingsSheet(XSSFWorkbook wb, String sheetName,
                                    List<Booking> bookings, Map<String, Room> roomMap,
                                    CellStyle titleStyle, CellStyle headerStyle,
                                    CellStyle currencyStyle, CellStyle dateStyle,
                                    String hotelName, LocalDate from, LocalDate to) {
        Sheet sheet = wb.createSheet(sheetName);
        int rowIdx = 0;

        // Tiêu đề báo cáo
        Row title = sheet.createRow(rowIdx++);
        Cell tc = title.createCell(0);
        tc.setCellValue(hotelName + " — Báo cáo đặt phòng ("
                + from.format(DATE_FMT) + " – " + to.format(DATE_FMT) + ")");
        tc.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 9));
        rowIdx++; // blank row

        String[] headers = {
            "Mã đặt phòng", "Phòng", "Loại phòng",
            "Check-in", "Check-out", "Số đêm", "Số khách",
            "Giá gốc (đ)", "Giảm giá (đ)", "Tổng tiền (đ)",
            "Thanh toán", "Trạng thái", "Ngày đặt"
        };
        Row header = sheet.createRow(rowIdx++);
        for (int i = 0; i < headers.length; i++) {
            Cell c = header.createCell(i);
            c.setCellValue(headers[i]);
            c.setCellStyle(headerStyle);
        }

        for (Booking b : bookings) {
            Row row = sheet.createRow(rowIdx++);
            Room room = roomMap.get(b.getRoomId());
            long nights = b.getCheckIn() != null && b.getCheckOut() != null
                    ? b.getCheckOut().toEpochDay() - b.getCheckIn().toEpochDay() : 0;

            row.createCell(0).setCellValue(b.getId());
            row.createCell(1).setCellValue(room != null ? room.getRoomNumber() : "—");
            row.createCell(2).setCellValue(room != null ? room.getType().name() : "—");
            row.createCell(3).setCellValue(b.getCheckIn() != null ? b.getCheckIn().format(DATE_FMT) : "—");
            row.createCell(4).setCellValue(b.getCheckOut() != null ? b.getCheckOut().format(DATE_FMT) : "—");
            row.createCell(5).setCellValue(nights);
            row.createCell(6).setCellValue(b.getGuestCount() != null ? b.getGuestCount() : 1);

            Cell origCell = row.createCell(7);
            origCell.setCellValue(b.getOriginalPrice() != null ? b.getOriginalPrice() : 0);
            origCell.setCellStyle(currencyStyle);

            Cell discCell = row.createCell(8);
            discCell.setCellValue(b.getDiscountAmount() != null ? b.getDiscountAmount() : 0);
            discCell.setCellStyle(currencyStyle);

            Cell totalCell = row.createCell(9);
            totalCell.setCellValue(b.getTotalPrice() != null ? b.getTotalPrice() : 0);
            totalCell.setCellStyle(currencyStyle);

            row.createCell(10).setCellValue(
                    b.getPaymentStatus() != null ? b.getPaymentStatus().name() : "—");
            row.createCell(11).setCellValue(
                    b.getStatus() != null ? b.getStatus().name() : "—");
            row.createCell(12).setCellValue(
                    b.getCreatedAt() != null
                            ? b.getCreatedAt().toLocalDate().format(DATE_FMT) : "—");
        }

        // Tổng cộng
        Row total = sheet.createRow(rowIdx + 1);
        Cell totalLabel = total.createCell(8);
        totalLabel.setCellValue("Tổng doanh thu:");
        totalLabel.setCellStyle(headerStyle);
        Cell totalVal = total.createCell(9);
        double totalRevenue = bookings.stream()
                .filter(b -> b.getPaymentStatus() == PaymentStatus.PAID)
                .mapToDouble(b -> b.getTotalPrice() != null ? b.getTotalPrice() : 0).sum();
        totalVal.setCellValue(totalRevenue);
        totalVal.setCellStyle(currencyStyle);

        autoSizeColumns(sheet, headers.length);
    }

    // ── Sheet 2: Doanh thu theo tháng ────────────────────────────────────

    private void writeRevenueSheet(XSSFWorkbook wb, String sheetName,
                                   List<Document> docs,
                                   CellStyle titleStyle, CellStyle headerStyle,
                                   CellStyle currencyStyle) {
        Sheet sheet = wb.createSheet(sheetName);
        int rowIdx = 0;

        Row title = sheet.createRow(rowIdx++);
        Cell tc = title.createCell(0);
        tc.setCellValue("Doanh thu theo tháng");
        tc.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 2));
        rowIdx++;

        String[] headers = {"Tháng", "Số booking", "Doanh thu (đ)"};
        Row header = sheet.createRow(rowIdx++);
        for (int i = 0; i < headers.length; i++) {
            Cell c = header.createCell(i);
            c.setCellValue(headers[i]);
            c.setCellStyle(headerStyle);
        }

        for (Document doc : docs) {
            Document id = (Document) doc.get("_id");
            String period = String.format("%d-%02d", id.getInteger("year"), id.getInteger("month"));
            Row row = sheet.createRow(rowIdx++);
            row.createCell(0).setCellValue(period);
            row.createCell(1).setCellValue(((Number) doc.get("count")).longValue());
            Cell rev = row.createCell(2);
            rev.setCellValue(((Number) doc.get("revenue")).doubleValue());
            rev.setCellStyle(currencyStyle);
        }

        autoSizeColumns(sheet, headers.length);
    }

    // ── Sheet 3: Thống kê mã giảm giá ────────────────────────────────────

    private void writeDiscountSheet(XSSFWorkbook wb, String sheetName,
                                    List<Document> docs, Map<String, Discount> discountMap,
                                    CellStyle titleStyle, CellStyle headerStyle,
                                    CellStyle currencyStyle) {
        Sheet sheet = wb.createSheet(sheetName);
        int rowIdx = 0;

        Row title = sheet.createRow(rowIdx++);
        Cell tc = title.createCell(0);
        tc.setCellValue("Thống kê mã giảm giá");
        tc.setCellStyle(titleStyle);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 3));
        rowIdx++;

        String[] headers = {"Mã code", "Tên chương trình", "Lần dùng", "Tổng tiền giảm (đ)"};
        Row header = sheet.createRow(rowIdx++);
        for (int i = 0; i < headers.length; i++) {
            Cell c = header.createCell(i);
            c.setCellValue(headers[i]);
            c.setCellStyle(headerStyle);
        }

        for (Document doc : docs) {
            String   discountId = doc.getString("_id");
            Discount discount   = discountMap.get(discountId);
            Row row = sheet.createRow(rowIdx++);
            row.createCell(0).setCellValue(discount != null ? discount.getCode() : discountId);
            row.createCell(1).setCellValue(discount != null ? discount.getName() : "—");
            row.createCell(2).setCellValue(((Number) doc.get("usageCount")).longValue());
            Cell amt = row.createCell(3);
            amt.setCellValue(((Number) doc.get("totalDiscount")).doubleValue());
            amt.setCellStyle(currencyStyle);
        }

        autoSizeColumns(sheet, headers.length);
    }

    // ── Style helpers ─────────────────────────────────────────────────────

    private CellStyle buildTitleStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 13);
        s.setFont(f);
        return s;
    }

    private CellStyle buildHeaderStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setBorderBottom(BorderStyle.THIN);
        s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }

    private CellStyle buildCurrencyStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setDataFormat(wb.createDataFormat().getFormat("#,##0"));
        return s;
    }

    private CellStyle buildDateStyle(XSSFWorkbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setDataFormat(wb.createDataFormat().getFormat("dd/mm/yyyy"));
        return s;
    }

    private void autoSizeColumns(Sheet sheet, int numColumns) {
        for (int i = 0; i < numColumns; i++) {
            sheet.autoSizeColumn(i);
            // Thêm padding để tránh bị cắt
            sheet.setColumnWidth(i, sheet.getColumnWidth(i) + 512);
        }
    }
}
