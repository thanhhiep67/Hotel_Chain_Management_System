package com.example.Back_End.service;

import com.example.Back_End.dto.request.MessageRequest;
import com.example.Back_End.dto.response.MessageResponse;
import com.example.Back_End.dto.response.PageResponse;
import com.example.Back_End.dto.response.ThreadSummaryResponse;
import com.example.Back_End.exception.AppException;
import com.example.Back_End.exception.ErrorCode;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Message;
import com.example.Back_End.model.User;
import com.example.Back_End.model.enums.UserRole;
import com.example.Back_End.repository.HotelRepository;
import com.example.Back_End.repository.MessageRepository;
import com.example.Back_End.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.bson.Document;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository     messageRepository;
    private final HotelRepository       hotelRepository;
    private final UserRepository        userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final MongoTemplate         mongoTemplate;
    private final StringRedisTemplate   stringRedisTemplate;

    @Value("${app.upload.dir}")
    private String uploadDir;

    private static final int    RATE_LIMIT_MAX     = 20;   // max messages per window
    private static final long   RATE_LIMIT_SECONDS = 60;   // window size (seconds)
    private static final LocalTime BUSINESS_START  = LocalTime.of(8, 0);
    private static final LocalTime BUSINESS_END    = LocalTime.of(22, 0);
    private static final ZoneId    VN_ZONE         = ZoneId.of("Asia/Ho_Chi_Minh");

    /** threadId = userId + "_" + hotelId */
    public static String buildThreadId(String userId, String hotelId) {
        return userId + "_" + hotelId;
    }

    // ── parse & validate ─────────────────────────────────────────────────────

    private String[] parseThread(String threadId) {
        if (threadId == null || !threadId.contains("_"))
            throw new AppException(ErrorCode.MESSAGE_INVALID_THREAD);
        String[] parts = threadId.split("_", 2);
        if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank())
            throw new AppException(ErrorCode.MESSAGE_INVALID_THREAD);
        return parts; // [userId, hotelId]
    }

    // ── Upload image ──────────────────────────────────────────────────────────

    public String uploadImage(String uploaderEmail, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new AppException(ErrorCode.MESSAGE_INVALID_FILE);

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/"))
            throw new AppException(ErrorCode.MESSAGE_INVALID_FILE);

        String ext      = StringUtils.getFilenameExtension(file.getOriginalFilename());
        String filename = UUID.randomUUID() + (ext != null ? "." + ext : ".jpg");

        try {
            Path dir = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(dir);
            Files.write(dir.resolve(filename), file.getBytes());
        } catch (IOException e) {
            throw new AppException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
        return "/uploads/chat/" + filename;
    }

    // ── Send ─────────────────────────────────────────────────────────────────

    public MessageResponse sendMessage(String senderEmail, MessageRequest request) {
        boolean hasContent = request.getContent() != null && !request.getContent().isBlank();
        boolean hasImage   = request.getImageUrl() != null && !request.getImageUrl().isBlank();
        if (!hasContent && !hasImage)
            throw new AppException(ErrorCode.MESSAGE_EMPTY);

        String[] parts   = parseThread(request.getThreadId());
        String   userId  = parts[0];
        String   hotelId = parts[1];

        User sender = userRepository.findByEmail(senderEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        verifyAccess(sender, userId, hotelId);
        checkRateLimit(sender.getId());

        Hotel hotel = hotelRepository.findById(hotelId)
                .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));

        // Resolve reply-to snapshot
        String replyToId      = request.getReplyToId();
        String replyToContent = null;
        if (replyToId != null && !replyToId.isBlank()) {
            replyToContent = messageRepository.findById(replyToId)
                    .map(m -> m.getImageUrl() != null && !m.getImageUrl().isBlank()
                            ? "[Ảnh]" : m.getContent())
                    .orElse(null);
        }

        Message saved = messageRepository.save(Message.builder()
                .threadId(request.getThreadId())
                .userId(userId)
                .hotelId(hotelId)
                .bookingId(request.getBookingId())
                .imageUrl(request.getImageUrl())
                .replyToId(replyToId)
                .replyToContent(replyToContent)
                .senderId(sender.getId())
                .senderRole(sender.getRole())
                .senderName(sender.getFullName())
                .content(request.getContent() != null ? request.getContent().trim() : "")
                .createdAt(LocalDateTime.now())
                .build());

        MessageResponse response = toResponse(saved);
        messagingTemplate.convertAndSend("/topic/chat/" + saved.getThreadId(), response);

        // Notify bên kia nếu họ không đang mở chat
        if (sender.getRole() == UserRole.USER) {
            messagingTemplate.convertAndSend("/topic/hotel/" + hotelId,
                    buildChatNotif(saved, hotel.getName(), sender.getFullName()));
            // Auto-reply ngoài giờ làm việc
            sendOutOfOfficeIfNeeded(userId, hotelId, request.getThreadId());
        } else {
            userRepository.findById(userId).ifPresent(guest ->
                    messagingTemplate.convertAndSendToUser(
                            guest.getEmail(), "/queue/notifications",
                            buildChatNotif(saved, hotel.getName(), sender.getFullName())));
        }

        return response;
    }

    // ── History ──────────────────────────────────────────────────────────────

    public PageResponse<MessageResponse> getMessages(String viewerEmail, String threadId,
                                                     int page, int size, String keyword) {
        String[] parts   = parseThread(threadId);
        String   userId  = parts[0];
        String   hotelId = parts[1];

        User viewer = userRepository.findByEmail(viewerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        verifyAccess(viewer, userId, hotelId);

        boolean hasKeyword = keyword != null && !keyword.isBlank();

        if (hasKeyword) {
            // Keyword search — không phân trang, trả về tất cả kết quả khớp
            Criteria criteria = Criteria.where("threadId").is(threadId)
                    .and("content").regex(keyword.trim(), "i");
            List<Message> matched = mongoTemplate.find(
                    Query.query(criteria).with(Sort.by("createdAt").ascending()), Message.class);
            List<MessageResponse> content = matched.stream().map(this::toResponse).toList();
            return PageResponse.<MessageResponse>builder()
                    .content(content).page(0).size(content.size())
                    .totalElements(content.size()).totalPages(1)
                    .build();
        }

        // Sort DESC → page 0 = tin mới nhất; đảo ngược để hiển thị cũ → mới
        Page<Message> msgPage = messageRepository.findByThreadId(
                threadId, PageRequest.of(page, size, Sort.by("createdAt").descending()));

        List<MessageResponse> content = msgPage.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        Collections.reverse(content);

        return PageResponse.<MessageResponse>builder()
                .content(content).page(page).size(size)
                .totalElements(msgPage.getTotalElements())
                .totalPages(msgPage.getTotalPages())
                .build();
    }

    // ── Thread info (header) ─────────────────────────────────────────────────

    public ThreadSummaryResponse getThreadInfo(String viewerEmail, String threadId) {
        String[] parts   = parseThread(threadId);
        String   userId  = parts[0];
        String   hotelId = parts[1];

        User viewer = userRepository.findByEmail(viewerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        verifyAccess(viewer, userId, hotelId);

        String hotelName = hotelRepository.findById(hotelId).map(Hotel::getName).orElse("—");
        String userName  = userRepository.findById(userId).map(User::getFullName).orElse("—");
        long   unread    = messageRepository.countByThreadIdAndIsReadFalseAndSenderIdNot(
                threadId, viewer.getId());

        return ThreadSummaryResponse.builder()
                .threadId(threadId)
                .hotelId(hotelId).hotelName(hotelName)
                .userId(userId).userName(userName)
                .unreadCount(unread)
                .build();
    }

    // ── Inbox (thread list) ───────────────────────────────────────────────────

    public PageResponse<ThreadSummaryResponse> getThreads(String viewerEmail, int page, int size) {
        User viewer = userRepository.findByEmail(viewerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Criteria matchCriteria = switch (viewer.getRole()) {
            case USER  -> Criteria.where("userId").is(viewer.getId());
            case STAFF -> {
                if (viewer.getHotelId() == null) yield null;
                yield Criteria.where("hotelId").is(viewer.getHotelId());
            }
            case OWNER -> {
                List<String> ids = hotelRepository.findByOwnerId(viewer.getId())
                        .stream().map(Hotel::getId).toList();
                if (ids.isEmpty()) yield null;
                yield Criteria.where("hotelId").in(ids);
            }
            default -> null;
        };

        if (matchCriteria == null)
            return PageResponse.<ThreadSummaryResponse>builder()
                    .content(List.of()).page(page).size(size).totalElements(0).totalPages(0).build();

        // Aggregation: latest message per thread + pagination
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(matchCriteria),
                Aggregation.sort(Sort.by(Sort.Direction.DESC, "createdAt")),
                Aggregation.group("threadId")
                        .first("threadId").as("threadId")
                        .first("userId").as("userId")
                        .first("hotelId").as("hotelId")
                        .first("content").as("lastMessage")
                        .first("createdAt").as("lastMessageAt"),
                Aggregation.sort(Sort.by(Sort.Direction.DESC, "lastMessageAt")),
                Aggregation.skip((long) page * size),
                Aggregation.limit(size)
        );

        // Count aggregation for totalElements
        Aggregation countAgg = Aggregation.newAggregation(
                Aggregation.match(matchCriteria),
                Aggregation.group("threadId"),
                Aggregation.count().as("total")
        );
        AggregationResults<Document> countResult = mongoTemplate.aggregate(countAgg, "messages", Document.class);
        long totalElements = countResult.getMappedResults().isEmpty()
                ? 0L : ((Number) countResult.getMappedResults().get(0).get("total")).longValue();
        int  totalPages    = (int) Math.ceil((double) totalElements / size);

        AggregationResults<Document> results = mongoTemplate.aggregate(agg, "messages", Document.class);

        Map<String, String> hotelNames = new HashMap<>();
        Map<String, String> userNames  = new HashMap<>();

        List<ThreadSummaryResponse> content = results.getMappedResults().stream().map(doc -> {
            String tid = doc.getString("threadId");
            String hId = doc.getString("hotelId");
            String uId = doc.getString("userId");
            String hotelNm = hotelNames.computeIfAbsent(hId,
                    id -> hotelRepository.findById(id).map(Hotel::getName).orElse("—"));
            String userNm  = userNames.computeIfAbsent(uId,
                    id -> userRepository.findById(id).map(User::getFullName).orElse("—"));
            long unread    = messageRepository.countByThreadIdAndIsReadFalseAndSenderIdNot(
                    tid, viewer.getId());

            return ThreadSummaryResponse.builder()
                    .threadId(tid).hotelId(hId).hotelName(hotelNm)
                    .userId(uId).userName(userNm)
                    .lastMessage(doc.getString("lastMessage"))
                    .lastMessageAt(doc.getDate("lastMessageAt") != null
                            ? doc.getDate("lastMessageAt").toInstant()
                                    .atZone(ZoneId.systemDefault()).toLocalDateTime()
                            : null)
                    .unreadCount(unread)
                    .build();
        }).collect(Collectors.toList());

        return PageResponse.<ThreadSummaryResponse>builder()
                .content(content).page(page).size(size)
                .totalElements(totalElements).totalPages(totalPages)
                .build();
    }

    // ── System message ───────────────────────────────────────────────────────

    /** Tạo tin nhắn hệ thống tự động (booking confirmed / check-in / check-out). */
    public void createSystemMessage(String userId, String hotelId, String content) {
        String threadId = buildThreadId(userId, hotelId);
        Message msg = Message.builder()
                .threadId(threadId)
                .userId(userId)
                .hotelId(hotelId)
                .senderId("SYSTEM")
                .senderName("Hệ thống")
                .content(content)
                .isSystem(true)
                .createdAt(LocalDateTime.now())
                .build();
        Message saved = messageRepository.save(msg);
        messagingTemplate.convertAndSend("/topic/chat/" + threadId, toResponse(saved));
    }

    // ── Mark read ─────────────────────────────────────────────────────────────

    public long markAsRead(String viewerEmail, String threadId) {
        String[] parts   = parseThread(threadId);
        String   userId  = parts[0];
        String   hotelId = parts[1];

        User viewer = userRepository.findByEmail(viewerEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        verifyAccess(viewer, userId, hotelId);

        Query  query  = Query.query(Criteria.where("threadId").is(threadId)
                .and("senderId").ne(viewer.getId()).and("isRead").is(false));
        Update update = new Update().set("isRead", true);
        long count = mongoTemplate.updateMulti(query, update, Message.class).getModifiedCount();

        if (count > 0) {
            messagingTemplate.convertAndSend("/topic/chat/" + threadId,
                    Map.of("type", "READ_RECEIPT", "threadId", threadId, "readerId", viewer.getId()));
        }
        return count;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void checkRateLimit(String senderId) {
        String key   = "rate:msg:" + senderId;
        Long   count = stringRedisTemplate.opsForValue().increment(key);
        if (count == 1) stringRedisTemplate.expire(key, RATE_LIMIT_SECONDS, TimeUnit.SECONDS);
        if (count != null && count > RATE_LIMIT_MAX)
            throw new AppException(ErrorCode.MESSAGE_RATE_LIMITED);
    }

    private void sendOutOfOfficeIfNeeded(String userId, String hotelId, String threadId) {
        LocalTime nowVn = ZonedDateTime.now(VN_ZONE).toLocalTime();
        if (nowVn.isBefore(BUSINESS_START) || nowVn.isAfter(BUSINESS_END)) {
            createSystemMessage(userId, hotelId,
                    "Hiện ngoài giờ làm việc (8:00–22:00). Chúng tôi sẽ phản hồi sớm nhất có thể.");
        }
    }

    private void verifyAccess(User actor, String userId, String hotelId) {
        switch (actor.getRole()) {
            case USER  -> {
                if (!actor.getId().equals(userId))
                    throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
            }
            case STAFF -> {
                if (actor.getHotelId() == null || !hotelId.equals(actor.getHotelId()))
                    throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
            }
            case OWNER -> {
                Hotel hotel = hotelRepository.findById(hotelId)
                        .orElseThrow(() -> new AppException(ErrorCode.HOTEL_NOT_FOUND));
                if (!hotel.getOwnerId().equals(actor.getId()))
                    throw new AppException(ErrorCode.BOOKING_ACCESS_DENIED);
            }
            case ADMIN -> { /* không giới hạn */ }
        }
    }

    private MessageResponse toResponse(Message m) {
        return MessageResponse.builder()
                .id(m.getId()).threadId(m.getThreadId())
                .userId(m.getUserId()).hotelId(m.getHotelId()).bookingId(m.getBookingId())
                .senderId(m.getSenderId()).senderRole(m.getSenderRole()).senderName(m.getSenderName())
                .imageUrl(m.getImageUrl())
                .replyToId(m.getReplyToId()).replyToContent(m.getReplyToContent())
                .content(m.getContent()).isRead(m.isRead()).isSystem(m.isSystem()).createdAt(m.getCreatedAt())
                .build();
    }

    private Map<String, Object> buildChatNotif(Message m, String hotelName, String senderName) {
        String preview = m.getContent().length() > 50
                ? m.getContent().substring(0, 50) + "…"
                : m.getContent();
        return Map.of(
                "eventType",  "NEW_MESSAGE",
                "threadId",   m.getThreadId(),
                "hotelId",    m.getHotelId(),
                "senderName", senderName,
                "hotelName",  hotelName,
                "preview",    preview
        );
    }
}
