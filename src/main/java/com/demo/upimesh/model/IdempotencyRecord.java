package com.demo.upimesh.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Persisted idempotency audit ledger.
 * Ensures that even across backend crashes, redeployments, or node restarts,
 * previously seen or settled ciphertext packet hashes are permanently deduplicated,
 * guaranteeing zero double-spending in a multi-instance production environment.
 */
@Entity
@Table(name = "idempotency_records", indexes = {
        @Index(name = "idx_idempotency_claimed_at", columnList = "claimedAt")
})
public class IdempotencyRecord {

    @Id
    @Column(length = 64, nullable = false)
    private String packetHash;

    @Column(nullable = false)
    private Instant claimedAt;

    @Column(length = 32, nullable = false)
    private String outcome; // CLAIMED, SETTLED, DUPLICATE_DROPPED, INVALID

    @Column(length = 64)
    private String bridgeNodeId;

    public IdempotencyRecord() {}

    public IdempotencyRecord(String packetHash, Instant claimedAt, String outcome, String bridgeNodeId) {
        this.packetHash = packetHash;
        this.claimedAt = claimedAt;
        this.outcome = outcome;
        this.bridgeNodeId = bridgeNodeId;
    }

    public String getPacketHash() { return packetHash; }
    public void setPacketHash(String packetHash) { this.packetHash = packetHash; }

    public Instant getClaimedAt() { return claimedAt; }
    public void setClaimedAt(Instant claimedAt) { this.claimedAt = claimedAt; }

    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }

    public String getBridgeNodeId() { return bridgeNodeId; }
    public void setBridgeNodeId(String bridgeNodeId) { this.bridgeNodeId = bridgeNodeId; }
}

