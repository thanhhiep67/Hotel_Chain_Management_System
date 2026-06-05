package com.example.Back_End.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class RecommendationRateLimitInterceptor implements HandlerInterceptor {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final int  MAX_REQUESTS  = 10;
    private static final long WINDOW_SECS   = 60;
    private static final String KEY_PREFIX  = "ratelimit:rec:";

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()
                || "anonymousUser".equals(auth.getPrincipal())) {
            return true; // unauthenticated → let security layer handle it
        }

        String key   = KEY_PREFIX + auth.getPrincipal();
        Long   count = redisTemplate.opsForValue().increment(key);

        // Đặt TTL chỉ ở lần đầu (count == 1)
        if (count != null && count == 1) {
            redisTemplate.expire(key, Duration.ofSeconds(WINDOW_SECS));
        }

        if (count != null && count > MAX_REQUESTS) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"statusCode\":429,\"message\":\"Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.\"}");
            return false;
        }

        return true;
    }
}
