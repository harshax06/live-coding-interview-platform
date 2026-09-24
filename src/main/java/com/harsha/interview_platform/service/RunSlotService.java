package com.harsha.interview_platform.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Cross-instance replacements for RunCoordinator's old in-memory `runningRooms` Set and
 * `capacity` Semaphore - both of those only counted runs on ONE instance, so with two
 * instances up, each would independently allow "one run per room" and "4 concurrent runs",
 * silently doubling the real limits.
 *
 * roomLock: a Redis key that only one instance can hold at a time (SET NX), with a TTL so a
 * crashed instance can't leave a room permanently locked. A random token per attempt lets
 * release() delete only the lock IT holds via a Lua script, never someone else's lock that
 * acquired after this one's TTL expired.
 *
 * globalCapacity: an atomic Redis counter shared by every instance, so "at most 4 sandboxes
 * across the whole server" means the whole fleet, not 4 per instance.
 */
@Service
public class RunSlotService {

    private static final String LOCK_PREFIX = "run-lock:";
    private static final String CAPACITY_KEY = "run-capacity";
    private static final int MAX_CONCURRENT_RUNS = 4;
    // Must exceed the longest possible run (15s compiled + a few s of container startup/teardown),
    // so a slow-but-healthy run's lock never expires out from under it.
    private static final Duration LOCK_TTL = Duration.ofSeconds(25);

    // Delete-if-owner: without this, instance A releasing a lock could delete instance B's lock
    // if A's own lock had already expired and B had since acquired the same key.
    private static final DefaultRedisScript<Long> RELEASE_IF_OWNER = new DefaultRedisScript<>("""
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """, Long.class);

    private final RedisTemplate<String, String> redisTemplate;

    public RunSlotService(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** A per-attempt token, opaque to the caller - pass it back to releaseRoomLock. */
    public String tryAcquireRoomLock(String roomCode) {
        String token = UUID.randomUUID().toString();
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(LOCK_PREFIX + roomCode, token, LOCK_TTL);
        return Boolean.TRUE.equals(acquired) ? token : null;
    }

    public void releaseRoomLock(String roomCode, String token) {
        redisTemplate.execute(RELEASE_IF_OWNER, List.of(LOCK_PREFIX + roomCode), token);
    }

    /** Atomically claims one of MAX_CONCURRENT_RUNS global slots. Returns false if the fleet is at capacity. */
    public boolean tryAcquireCapacity() {
        Long count = redisTemplate.opsForValue().increment(CAPACITY_KEY);
        if (count == null) return false;
        if (count > MAX_CONCURRENT_RUNS) {
            redisTemplate.opsForValue().decrement(CAPACITY_KEY);
            return false;
        }
        // Guards against the counter drifting upward forever if an instance crashes mid-run
        // without releasing: worst case it self-heals to 0 after a quiet minute.
        if (count == 1) redisTemplate.expire(CAPACITY_KEY, Duration.ofMinutes(1));
        return true;
    }

    public void releaseCapacity() {
        redisTemplate.opsForValue().decrement(CAPACITY_KEY);
    }
}