package com.example.Back_End.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title       = "Hotel Chain Management API",
                version     = "1.0",
                description = "Hệ thống quản lý chuỗi khách sạn — tài liệu REST API"
        ),
        servers = @Server(url = "http://localhost:8080", description = "Local Dev")
)
@SecurityScheme(
        name         = "bearerAuth",
        type         = SecuritySchemeType.HTTP,
        scheme       = "bearer",
        bearerFormat = "JWT",
        description  = "Nhập JWT access token (không cần prefix 'Bearer ')"
)
public class OpenApiConfig {}
