package com.example.Back_End.config;

import com.example.Back_End.model.Hotel;
import com.example.Back_End.util.CityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class CitySlugMigration {

    private final MongoTemplate mongoTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void backfillCitySlugs() {
        Query query = Query.query(Criteria.where("citySlug").exists(false));
        List<Hotel> hotels = mongoTemplate.find(query, Hotel.class);
        if (hotels.isEmpty()) return;

        log.info("Backfilling citySlug for {} hotels...", hotels.size());

        BulkOperations bulk = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, Hotel.class);
        for (Hotel hotel : hotels) {
            Query q = Query.query(Criteria.where("id").is(hotel.getId()));
            Update u = Update.update("citySlug", CityUtils.normalize(hotel.getCity()));
            bulk.updateOne(q, u);
        }
        bulk.execute();

        log.info("citySlug backfill complete.");
    }
}
