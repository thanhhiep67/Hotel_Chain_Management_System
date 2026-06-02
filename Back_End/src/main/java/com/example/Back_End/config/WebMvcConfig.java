package com.example.Back_End.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String absPath = Paths.get(uploadDir).toAbsolutePath().normalize().toString()
                .replace("\\", "/");
        registry.addResourceHandler("/uploads/chat/**")
                .addResourceLocations("file:" + absPath + "/");
    }
}
