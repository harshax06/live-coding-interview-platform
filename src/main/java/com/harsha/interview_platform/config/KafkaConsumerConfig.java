package com.harsha.interview_platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
public class KafkaConsumerConfig {

    // If persisting fails (e.g. Postgres is down), retry the SAME record every 2s, forever, instead of
    // the default "retry a few times, then skip". For an event log, skipping means silently losing data.
    // Spring Boot picks this bean up for all @KafkaListener containers automatically.
    @Bean
    public DefaultErrorHandler kafkaErrorHandler() {
        return new DefaultErrorHandler(new FixedBackOff(2000L, FixedBackOff.UNLIMITED_ATTEMPTS));
    }
}