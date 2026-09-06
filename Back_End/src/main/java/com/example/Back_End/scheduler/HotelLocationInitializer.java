package com.example.Back_End.scheduler;

import com.example.Back_End.model.GeoLocation;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.enums.HotelStatus;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.service.GeocodingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class HotelLocationInitializer implements ApplicationRunner {

    private final HotelRepository hotelRepository;
    private final GeocodingService geocodingService;

    @Override
    public void run(ApplicationArguments args) {
        // Run in background so startup is not delayed
        new Thread(this::geocodeMissingLocations, "hotel-geocode-fix").start();
    }

    private void geocodeMissingLocations() {
        List<Hotel> toFix = hotelRepository.findAll().stream()
                .filter(h -> h.getStatus() == HotelStatus.APPROVED && h.getLocation() == null)
                .toList();

        if (toFix.isEmpty()) return;

        log.info("Geocoding {} approved hotels with missing location data...", toFix.size());
        for (Hotel hotel : toFix) {
            try {
                geocodingService.geocode(
                        hotel.getAddress() != null ? hotel.getAddress() : "",
                        hotel.getCity()    != null ? hotel.getCity()    : ""
                ).ifPresent(coords -> {
                    hotel.setLocation(GeoLocation.of(coords[0], coords[1]));
                    hotelRepository.save(hotel);
                    log.info("Geocoded '{}' → [{}, {}]", hotel.getName(), coords[0], coords[1]);
                });
                // Nominatim policy: max 1 request per second
                Thread.sleep(1200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        log.info("Hotel location geocoding complete.");
    }
}
