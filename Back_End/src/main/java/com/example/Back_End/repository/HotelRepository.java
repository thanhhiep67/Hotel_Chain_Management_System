package com.example.Back_End.repository;

import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.enums.HotelStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface HotelRepository extends MongoRepository<Hotel, String> {

    List<Hotel> findByOwnerId(String ownerId);

    Page<Hotel> findByCityAndStatus(String city, HotelStatus status, Pageable pageable);

    Page<Hotel> findByStatus(HotelStatus status, Pageable pageable);
}
