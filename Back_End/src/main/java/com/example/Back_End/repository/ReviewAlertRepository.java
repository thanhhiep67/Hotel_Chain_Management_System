package com.example.Back_End.repository;

import com.example.Back_End.model.ReviewAlert;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ReviewAlertRepository extends MongoRepository<ReviewAlert, String> {

    boolean existsByUserIdAndResolvedFalse(String userId);

    List<ReviewAlert> findByResolvedOrderByTriggeredAtDesc(boolean resolved);
}
