package com.example.Back_End.service;

import com.example.Back_End.dto.request.UpdateStatusRequest;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.UserResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.model.enums.UserStatus;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;

    public PageResponse<UserResponse> getAllUsers(UserRole role, UserStatus status, int page, int size) {
        List<Criteria> filters = new ArrayList<>();
        if (role != null) filters.add(Criteria.where("role").is(role));
        if (status != null) filters.add(Criteria.where("status").is(status));

        Criteria combined = filters.isEmpty() ? new Criteria() : new Criteria().andOperator(filters);

        long total = mongoTemplate.count(Query.query(combined), User.class);

        Query dataQuery = Query.query(combined)
                .with(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<UserResponse> content = mongoTemplate.find(dataQuery, User.class)
                .stream().map(this::toUserResponse).toList();

        return PageResponse.<UserResponse>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages((int) Math.ceil((double) total / size))
                .build();
    }

    public UserResponse getUserById(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return toUserResponse(user);
    }

    public UserResponse getMe(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return toUserResponse(user);
    }

    public UserResponse updateStatus(String id, UpdateStatusRequest request) {
        UserStatus newStatus = request.getStatus();
        if (newStatus != UserStatus.ACTIVE && newStatus != UserStatus.LOCKED) {
            throw new AppException(ErrorCode.INVALID_STATUS);
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (user.getRole() == UserRole.ADMIN) {
            throw new AppException(ErrorCode.CANNOT_LOCK_ADMIN);
        }

        user.setStatus(newStatus);
        user.setUpdatedAt(LocalDateTime.now());
        return toUserResponse(userRepository.save(user));
    }

    public void deleteUser(String id) {
        if (!userRepository.existsById(id)) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }
        userRepository.deleteById(id);
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus())
                .hotelId(user.getHotelId())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
