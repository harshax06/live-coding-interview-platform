package com.harsha.interview_platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

@Configuration
public class RedisConfig {

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter presenceListenerAdapter,
            MessageListenerAdapter broadcastListenerAdapter) {

        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(presenceListenerAdapter, new ChannelTopic("presence-events"));
        container.addMessageListener(broadcastListenerAdapter, new ChannelTopic(RedisBroadcaster.channel()));
        return container;
    }

    @Bean
    public MessageListenerAdapter presenceListenerAdapter(PresenceRedisListener listener) {
        return new MessageListenerAdapter(listener, "handleMessage");
    }

    @Bean
    public MessageListenerAdapter broadcastListenerAdapter(BroadcastRedisListener listener) {
        return new MessageListenerAdapter(listener, "handleMessage");
    }
}