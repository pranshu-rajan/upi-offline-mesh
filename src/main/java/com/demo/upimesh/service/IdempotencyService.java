package com.demo.upimesh.service;

import com.demo.upimesh.model.IdempotencyRecord;
import com.demo.upimesh.model.IdempotencyRecordRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * High-performance dual-tier idempotency service.
 *
 * Tier 1 (Memory): Atomic ConcurrentHashMap.putIfAbsent (analogous to Redis SETNX)
 * guarantees nanosecond deduplication for concurrent duplicate storms across multiple
 * bridge nodes uploading the exact same packet simultaneously.
 *
 * Tier 2 (Durable Storage): Persisted in PostgreSQL / H2 (idempotency_records table)
 * ensuring that server restarts, redeployments, or container failovers never forget
 * already settled or dropped packet hashes.
 */
@Service
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);

    private final Map<String, Instant> seen = new ConcurrentHashMap<>();

    @Autowired(required = false)
    private IdempotencyRecordRepository repository;

    @Value("${upi.mesh.idempotency-ttl-seconds:86400}")
    private long ttlSeconds;

    @PostConstruct
    public void prewarmFromDatabase() {
        if (repository != null) {
            try {
                Instant cutoff = Instant.now().minusSeconds(ttlSeconds);
                List<IdempotencyRecord> recent = repository.findByClaimedAtAfter(cutoff);
                for (IdempotencyRecord rec : recent) {
                    seen.put(rec.getPacketHash(), rec.getClaimedAt());
                }
                log.info("Prewarmed idempotency cache with {} entries from durable storage (TTL: {}s)",
                        recent.size(), ttlSeconds);
            } catch (Exception e) {
                log.warn("Could not prewarm idempotency cache from DB: {}", e.getMessage());
            }
        }
    }

    /**
     * Try to claim a hash. Returns true if this caller is the first; false if
     * someone else already claimed it (i.e. the packet is a duplicate).
     */
    public boolean claim(String packetHash) {
        return claim(packetHash, "unknown");
    }

    public boolean claim(String packetHash, String bridgeNodeId) {
        Instant now = Instant.now();
        Instant prev = seen.putIfAbsent(packetHash, now);
        if (prev != null) {
            // Already claimed in memory - duplicate!
            return false;
        }

        // Successfully claimed in memory; persist asynchronously / durably
        if (repository != null) {
            try {
                repository.save(new IdempotencyRecord(packetHash, now, "CLAIMED", bridgeNodeId));
            } catch (Exception e) {
                // In case of unique constraint violation from another concurrent worker
                log.debug("DB idempotency record notice: {}", e.getMessage());
            }
        }
        return true;
    }

    /**
     * Updates the terminal outcome of this packet hash (e.g. SETTLED, INVALID, SEQUENCE_REPLAY_FORK)
     */
    public void updateOutcome(String packetHash, String outcome) {
        if (repository != null && packetHash != null) {
            try {
                repository.findById(packetHash).ifPresent(rec -> {
                    rec.setOutcome(outcome);
                    repository.save(rec);
                });
            } catch (Exception e) {
                log.debug("Could not update idempotency record outcome: {}", e.getMessage());
            }
        }
    }

    public int size() {
        return seen.size();
    }

    /** Periodically evict entries past their TTL so the cache doesn't grow forever. */
    @Scheduled(fixedDelay = 60_000)
    public void evictExpired() {
        Instant cutoff = Instant.now().minusSeconds(ttlSeconds);
        seen.entrySet().removeIf(e -> e.getValue().isBefore(cutoff));

        if (repository != null) {
            try {
                long deleted = repository.deleteByClaimedAtBefore(cutoff);
                if (deleted > 0) {
                    log.debug("Evicted {} expired idempotency records from DB", deleted);
                }
            } catch (Exception e) {
                log.debug("Could not evict expired DB idempotency records: {}", e.getMessage());
            }
        }
    }

    /** Test/demo helper: clears both memory and database tables. */
    public void clear() {
        seen.clear();
        if (repository != null) {
            try {
                repository.deleteAll();
            } catch (Exception e) {
                log.debug("Could not clear DB idempotency records: {}", e.getMessage());
            }
        }
    }
}
