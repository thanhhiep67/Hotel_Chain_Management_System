package com.example.Back_End.repository;

import com.example.Back_End.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface MessageRepository extends MongoRepository<Message, String> {

    Page<Message> findByThreadId(String threadId, Pageable pageable);

    // Lấy 1 tin mới nhất mỗi thread — dùng cho danh sách hội thoại
    List<Message> findByUserIdOrderByCreatedAtDesc(String userId);

    List<Message> findByHotelIdOrderByCreatedAtDesc(String hotelId);

    long countByThreadIdAndIsReadFalseAndSenderIdNot(String threadId, String viewerId);
}
