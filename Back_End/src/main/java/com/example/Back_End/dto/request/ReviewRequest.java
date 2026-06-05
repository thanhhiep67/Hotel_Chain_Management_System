package com.example.Back_End.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class ReviewRequest {

    private String bookingId;

    /** 1–5 sao */
    private Integer overallRating;
    private Integer cleanlinessRating;
    private Integer serviceRating;
    private Integer locationRating;

    private String comment;

    /** Tối đa 5 URL ảnh đính kèm (optional) */
    private List<String> images;
}
