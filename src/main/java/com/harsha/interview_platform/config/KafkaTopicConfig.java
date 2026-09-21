package com.harsha.interview_platform.config;

import com.harsha.interview_platform.event.SessionEventProducer;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    // Created on startup if missing. 3 partitions = up to 3 parallel consumers in one group.
    // Replication factor 1 because docker-compose runs a single broker.
    @Bean
    public NewTopic sessionEventsTopic() {
        return TopicBuilder.name(SessionEventProducer.TOPIC)
                .partitions(3)
                .replicas(1)
                .build();
    }
}