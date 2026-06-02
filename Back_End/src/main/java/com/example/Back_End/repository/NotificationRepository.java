package com.example.Back_End.repository;

import com.example.Back_End.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {

    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(String recipientId, Pageable pageable);

    Page<Notification> findByRecipientIdAndIsReadOrderByCreatedAtDesc(String recipientId, boolean isRead, Pageable pageable);

    Page<Notification> findByRecipientIdInOrderByCreatedAtDesc(List<String> recipientIds, Pageable pageable);

    Page<Notification> findByRecipientIdInAndIsReadOrderByCreatedAtDesc(List<String> recipientIds, boolean isRead, Pageable pageable);

    void deleteByRecipientId(String recipientId);

    void deleteByRecipientIdIn(List<String> recipientIds);
}
