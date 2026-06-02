package com.example.Back_End.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PresenceService {

    private final StringRedisTemplate stringRedisTemplate;

    private static final long TTL_SECONDS = 300; // 5 phút

    public void setOnline(String userId) {
        stringRedisTemplate.opsForValue().set("presence:" + userId, "1", TTL_SECONDS, TimeUnit.SECONDS);
    }

    public void setOffline(String userId) {
        stringRedisTemplate.delete("presence:" + userId);
    }

    public boolean isOnline(String userId) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey("presence:" + userId));
    }

    public Map<String, Boolean> getBulkStatus(List<String> userIds) {
        return userIds.stream().collect(Collectors.toMap(
                id -> id,
                this::isOnline
        ));
    }
}
