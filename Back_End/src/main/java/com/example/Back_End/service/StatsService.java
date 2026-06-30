package com.example.Back_End.service;

import com.example.Back_End.dto.response.StatsResponse;
import com.example.Back_End.model.Booking;
import com.example.Back_End.model.Hotel;
import com.example.Back_End.model.Room;
import com.example.Back_End.model.enums.BookingStatus;
import com.example.Back_End.model.enums.HotelStatus;
import com.example.Back_End.model.enums.ReviewStatus;
import com.example.Back_End.util.CityUtils;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final MongoTemplate mongoTemplate;

    public StatsResponse getStats() {
        long totalHotels = mongoTemplate.count(
                Query.query(Criteria.where("status").is(HotelStatus.APPROVED.name())),
                Hotel.class);

        long totalRooms = mongoTemplate.count(new Query(), Room.class);

        long totalGuests = mongoTemplate.count(
                Query.query(Criteria.where("status").in(
                        BookingStatus.CONFIRMED.name(),
                        BookingStatus.CHECKED_IN.name(),
                        BookingStatus.CHECKED_OUT.name())),
                Booking.class);

        Aggregation avgAgg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("status").is(ReviewStatus.APPROVED.name())),
                Aggregation.group().avg("overallRating").as("avg"));

        AggregationResults<Document> result = mongoTemplate.aggregate(avgAgg, "reviews", Document.class);
        double avgRating = 0.0;
        Document first = result.getUniqueMappedResult();
        if (first != null && first.get("avg") != null) {
            avgRating = ((Number) first.get("avg")).doubleValue();
        }

        return StatsResponse.builder()
                .totalHotels(totalHotels)
                .totalRooms(totalRooms)
                .totalGuests(totalGuests)
                .avgRating(Math.round(avgRating * 10.0) / 10.0)
                .build();
    }

    public Map<String, Long> getCityCounts(List<String> cities) {
        Map<String, Long> counts = new java.util.LinkedHashMap<>();
        for (String cityName : cities) {
            String slug = CityUtils.normalize(cityName);
            Criteria cityCriteria = new Criteria().orOperator(
                    Criteria.where("city").regex(cityName.trim(), "i"),
                    Criteria.where("citySlug").regex(slug, "i"));
            long count = mongoTemplate.count(
                    Query.query(Criteria.where("status").is(HotelStatus.APPROVED.name())
                            .andOperator(cityCriteria)),
                    Hotel.class);
            counts.put(cityName, count);
        }
        return counts;
    }
}
