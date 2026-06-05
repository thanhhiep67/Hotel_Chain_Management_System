package com.example.Back_End.config;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Auth
                        .requestMatchers("/auth/**").permitAll()
                        // WebSocket
                        .requestMatchers("/ws/**").permitAll()
                        // Hotel - public GET
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/hotels", "/hotels/**").permitAll()
                        // Room - public GET (xem phòng của hotel)
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/rooms/**").permitAll()
                        // Review - public GET (xem đánh giá của hotel)
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/reviews/hotel/**").permitAll()
                        // Uploaded chat images — public GET (URL được nhúng trong tin nhắn)
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/uploads/**").permitAll()
                        // Tất cả còn lại cần token
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        // Unauthenticated → 401
                        .authenticationEntryPoint((req, res, authEx) -> {
                            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            res.setContentType("application/json;charset=UTF-8");
                            res.getWriter().write("{\"statusCode\":401,\"message\":\"Unauthorized\"}");
                        })
                        // Authenticated nhưng sai role → 403 chuẩn JSON
                        .accessDeniedHandler((req, res, accessEx) -> {
                            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            res.setContentType("application/json;charset=UTF-8");
                            res.getWriter().write("{\"statusCode\":403,\"message\":\"Bạn không có quyền thực hiện thao tác này\"}");
                        })
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
