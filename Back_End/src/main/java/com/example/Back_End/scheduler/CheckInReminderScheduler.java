package com.example.Back_End.scheduler;

import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.repository.BookingRepository;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.RoomRepository;
import com.example.Back_End.repository.UserRepository;
import com.example.Back_End.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class CheckInReminderScheduler {

    private final BookingRepository bookingRepository;
    private final UserRepository    userRepository;
    private final RoomRepository    roomRepository;
    private final HotelRepository   hotelRepository;
    private final EmailService      emailService;

    /**
     * Runs every morning at 08:00 Vietnam time.
     * Sends a check-in reminder to guests whose booking check-in date is tomorrow.
     */
    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Ho_Chi_Minh")
    public void sendCheckInReminders() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        log.info("[CheckInReminder] Running for check-in date: {}", tomorrow);

        List<Booking> bookings = bookingRepository.findByCheckInDateAndStatusIn(
                tomorrow, List.of(BookingStatus.CONFIRMED));

        if (bookings.isEmpty()) {
            log.info("[CheckInReminder] No confirmed bookings for tomorrow.");
            return;
        }

        int sent = 0;
        for (Booking booking : bookings) {
            try {
                User  user  = userRepository.findById(booking.getUserId()).orElse(null);
                Room  room  = roomRepository.findById(booking.getRoomId()).orElse(null);
                Hotel hotel = hotelRepository.findById(booking.getHotelId()).orElse(null);

                if (user == null) {
                    log.warn("[CheckInReminder] User not found for booking {}", booking.getId());
                    continue;
                }

                emailService.sendCheckInReminderEmail(user, booking, room, hotel);
                sent++;
            } catch (Exception e) {
                log.error("[CheckInReminder] Failed for booking {}: {}", booking.getId(), e.getMessage());
            }
        }

        log.info("[CheckInReminder] Sent {} reminder(s) for {} booking(s).", sent, bookings.size());
    }
}
