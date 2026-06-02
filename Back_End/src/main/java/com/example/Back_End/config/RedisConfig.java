package com.example.Back_End.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

@Configuration
@EnableCaching
public class RedisConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(RedisConfig.class);

    private static ObjectMapper buildRedisObjectMapper() {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        om.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        om.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );
        return om;
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        Jackson2JsonRedisSerializer<Object> serializer =
                new Jackson2JsonRedisSerializer<>(buildRedisObjectMapper(), Object.class);

        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(serializer);
        template.setHashValueSerializer(serializer);
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        Jackson2JsonRedisSerializer<Object> serializer =
                new Jackson2JsonRedisSerializer<>(buildRedisObjectMapper(), Object.class);

        RedisSerializationContext.SerializationPair<Object> valuePair =
                RedisSerializationContext.SerializationPair.fromSerializer(serializer);
        RedisSerializationContext.SerializationPair<String> keyPair =
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer());

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .serializeKeysWith(keyPair)
                .serializeValuesWith(valuePair)
                .disableCachingNullValues();

        return RedisCacheManager.builder(factory)
                .cacheDefaults(base.entryTtl(Duration.ofMinutes(5)))
                .withInitialCacheConfigurations(Map.of(
                        "hotels:search",      base.entryTtl(Duration.ofMinutes(5)),
                        "hotels:detail",      base.entryTtl(Duration.ofMinutes(10)),
                        "hotels:admin",       base.entryTtl(Duration.ofMinutes(2)),
                        "rooms:available",    base.entryTtl(Duration.ofMinutes(1)),
                        "rooms:detail",       base.entryTtl(Duration.ofMinutes(10)),
                        "bookings:my",        base.entryTtl(Duration.ofMinutes(2)),
                        "bookings:hotel",     base.entryTtl(Duration.ofMinutes(1)),
                        "rooms:booked-dates", base.entryTtl(Duration.ofMinutes(1))
                ))
                .build();
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
                log.warn("[Cache] Read error on '{}' key='{}': {} — treating as miss",
                        cache.getName(), key, e.getMessage());
                // Evict the bad entry so it won't cause errors again
                try { cache.evict(key); } catch (Exception ignored) {}
            }
            @Override
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) {
                log.warn("[Cache] Write error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }
            @Override
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) {
                log.warn("[Cache] Evict error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }
            @Override
            public void handleCacheClearError(RuntimeException e, Cache cache) {
                log.warn("[Cache] Clear error on '{}': {}", cache.getName(), e.getMessage());
            }
        };
    }
}
