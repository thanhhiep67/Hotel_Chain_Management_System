package com.example.Back_End.dto.request;

import com.example.Back_End.model.enums.HotelStatus;
import lombok.Data;

@Data
public class UpdateHotelStatusRequest {
    private HotelStatus status;
}
