package com.example.Back_End.controller;

import com.example.Back_End.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('OWNER')")
public class ReportController {

    private final ReportService reportService;

    /**
     * GET /reports/export?hotelId=&from=2024-01-01&to=2024-12-31
     * Trả về file .xlsx
     */
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam String hotelId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication auth) {

        byte[] bytes = reportService.exportExcel(
                (String) auth.getPrincipal(), hotelId, from, to);

        String filename = "report_" + hotelId + "_" + from + "_" + to + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
