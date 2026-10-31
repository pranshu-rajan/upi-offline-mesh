package com.demo.upimesh.service;

import com.demo.upimesh.crypto.DeviceCryptoService;
import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.model.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Orchestrates the full server-side pipeline for one inbound packet from a bridge node:
 *
 *   1. Hash the ciphertext (SHA-256).
 *   2. Atomic idempotency gate (putIfAbsent in memory + persistent audit record).
 *      - If already claimed: duplicate packet dropped immediately.
 *   3. Decrypt the ciphertext with the server's private key (RSA-OAEP unwrap + AES-GCM auth tag).
 *      - If decryption fails: tampered or invalid.
 *   4. Freshness check — reject if signedAt is too old (anti-replay window).
 *   5. Device Signature verification (ECDSA P-256 non-repudiation and hardware authentication).
 *   6. Hand off to SettlementService for balance and monotonic counter verification.
 */
@Service
public class BridgeIngestionService {

    private static final Logger log = LoggerFactory.getLogger(BridgeIngestionService.class);

    @Autowired private HybridCryptoService crypto;
    @Autowired private DeviceCryptoService deviceCrypto;
    @Autowired private IdempotencyService idempotency;
    @Autowired private SettlementService settlement;
    @Autowired private AccountRepository accounts;

    @Value("${upi.mesh.packet-max-age-seconds:86400}")
    private long maxAgeSeconds;

    public IngestResult ingest(MeshPacket packet, String bridgeNodeId, int hopCount) {
        try {
            String packetHash = crypto.hashCiphertext(packet.getCiphertext());

            // ---- 1. Idempotency gate ----
            if (!idempotency.claim(packetHash, bridgeNodeId)) {
                log.info("DUPLICATE packet {} from bridge {} — dropped",
                        packetHash.substring(0, 12) + "...", bridgeNodeId);
                return IngestResult.duplicate(packetHash);
            }

            // ---- 2. Decrypt Hybrid RSA-OAEP + AES-GCM ----
            PaymentInstruction instruction;
            try {
                instruction = crypto.decrypt(packet.getCiphertext());
            } catch (Exception e) {
                log.warn("Decryption failed for packet {}: {}",
                        packetHash.substring(0, 12) + "...", e.getMessage());
                idempotency.updateOutcome(packetHash, "INVALID_DECRYPTION");
                return IngestResult.invalid(packetHash, "decryption_failed");
            }

            // ---- 3. Freshness check (replay protection) ----
            long ageSeconds = (Instant.now().toEpochMilli() - instruction.getSignedAt()) / 1000;
            if (ageSeconds > maxAgeSeconds) {
                log.warn("Packet {} too old ({}s), rejected",
                        packetHash.substring(0, 12) + "...", ageSeconds);
                idempotency.updateOutcome(packetHash, "STALE_PACKET");
                return IngestResult.invalid(packetHash, "stale_packet");
            }
            if (ageSeconds < -300) { // clock-skew tolerance
                idempotency.updateOutcome(packetHash, "FUTURE_DATED");
                return IngestResult.invalid(packetHash, "future_dated");
            }

            // ---- 4. Device Signature Verification (Hardware Non-Repudiation) ----
            if (instruction.getDeviceSignature() != null && !instruction.getDeviceSignature().isBlank()) {
                Account sender = accounts.findById(instruction.getSenderVpa()).orElse(null);
                String registeredPub = sender != null ? sender.getDevicePublicKey() : null;
                boolean validSig = deviceCrypto.verifyInstruction(instruction, registeredPub);
                if (!validSig) {
                    log.warn("Invalid device signature for sender {}: packet {}",
                            instruction.getSenderVpa(), packetHash.substring(0, 12) + "...");
                    idempotency.updateOutcome(packetHash, "INVALID_SIGNATURE");
                    return IngestResult.invalid(packetHash, "invalid_device_signature");
                }
            }

            // ---- 5. Settlement ----
            Transaction tx = settlement.settle(instruction, packetHash, bridgeNodeId, hopCount);
            if (tx.getStatus() == Transaction.Status.REJECTED) {
                idempotency.updateOutcome(packetHash, "REJECTED");
                return IngestResult.invalid(packetHash, "settlement_rejected_by_ledger");
            }

            idempotency.updateOutcome(packetHash, "SETTLED");
            return IngestResult.settled(packetHash, tx);

        } catch (Exception e) {
            log.error("Ingestion error: {}", e.getMessage(), e);
            return IngestResult.invalid("?", "internal_error: " + e.getMessage());
        }
    }

    public record IngestResult(String outcome, String packetHash, String reason, Long transactionId) {
        public static IngestResult settled(String hash, Transaction tx) {
            return new IngestResult("SETTLED", hash, null, tx.getId());
        }
        public static IngestResult duplicate(String hash) {
            return new IngestResult("DUPLICATE_DROPPED", hash, null, null);
        }
        public static IngestResult invalid(String hash, String reason) {
            return new IngestResult("INVALID", hash, reason, null);
        }
    }
}
