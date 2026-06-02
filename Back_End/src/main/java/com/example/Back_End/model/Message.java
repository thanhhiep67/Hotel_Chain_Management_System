package com.example.Back_End.model;

import com.example.Back_End.model.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "idx_thread_created", def = "{'threadId': 1, 'createdAt': 1}"),
    @CompoundIndex(name = "idx_thread_read",    def = "{'threadId': 1, 'isRead': 1, 'senderId': 1}"),
    @CompoundIndex(name = "idx_hotel_created",  def = "{'hotelId': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "idx_user_created",   def = "{'userId': 1,  'createdAt': -1}"),
})
public class Message {

    @Id
    private String id;

    /** userId_hotelId — định danh cuộc hội thoại */
    @Indexed
    private String threadId;

    private String userId;     // khách hàng trong cuộc trò chuyện
    private String hotelId;    // khách sạn trong cuộc trò chuyện

    private String bookingId;  // tham chiếu booking (optional)

    private String senderId;
    private UserRole senderRole;
    private String senderName;
    private String content;

    private String imageUrl;   // URL ảnh đính kèm (optional)

    private String replyToId;       // ID tin nhắn được trích dẫn (optional)
    private String replyToContent;  // Snapshot nội dung trích dẫn

    @Builder.Default
    private boolean isRead = false;

    @Builder.Default
    private boolean isSystem = false;   // tin nhắn tự động từ hệ thống

    private LocalDateTime createdAt;
}
