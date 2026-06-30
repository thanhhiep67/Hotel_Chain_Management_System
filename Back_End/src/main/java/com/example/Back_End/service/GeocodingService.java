package com.example.Back_End.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeocodingService {

    private static final String NOMINATIM =
            "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=vn&q=";

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ObjectMapper objectMapper;

    /**
     * Returns [longitude, latitude] (GeoJSON order) or empty if geocoding fails.
     */
    public Optional<double[]> geocode(String address, String city) {
        String query = String.join(", ", address, city, "Việt Nam");
        String url   = NOMINATIM + URLEncoder.encode(query, StandardCharsets.UTF_8);

        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "HotelChainApp/1.0")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());

            NominatimResult[] results = objectMapper.readValue(resp.body(), NominatimResult[].class);
            if (results.length == 0) {
                log.debug("Nominatim returned no results for: {}", query);
                return Optional.empty();
            }

            double lng = Double.parseDouble(results[0].getLon());
            double lat = Double.parseDouble(results[0].getLat());
            log.debug("Geocoded '{}' → [{}, {}]", query, lng, lat);
            return Optional.of(new double[]{ lng, lat });

        } catch (Exception ex) {
            log.warn("Geocoding failed for '{}': {}", query, ex.getMessage());
            return Optional.empty();
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NominatimResult {
        private String lat;
        private String lon;
    }
}
