package com.demo.upimesh;

import com.demo.upimesh.crypto.DeviceCryptoService;
import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.service.BridgeIngestionService;
import com.demo.upimesh.service.DemoService;
import com.demo.upimesh.service.IdempotencyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.Base64;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Concurrency and security test suite testing:
 *  1. Concurrent duplicate-storm idempotency settlement.
 *  2. AES-GCM bit-flip tampering rejection.
 *  3. Hybrid RSA-OAEP + AES-GCM round-trip encryption.
 *  4. Hardware ECDSA P-256 device signature verification.
 *  5. Forged device signature rejection.
 *  6. Monotonic sequence counter offline double-spending protection.
 */
@SpringBootTest
class IdempotencyConcurrencyTest {

    @Autowired private DemoService demoService;
    @Autowired private BridgeIngestionService bridge;
    @Autowired private IdempotencyService idempotency;
    @Autowired private AccountRepository accounts;
    @Autowired private HybridCryptoService crypto;
    @Autowired private DeviceCryptoService deviceCrypto;
    @Autowired private ServerKeyHolder serverKey;

    @BeforeEach
    void clear() {
        idempotency.clear();
    }

    @Test
    void singlePacketDeliveredByThreeBridgesSettlesExactlyOnce() throws Exception {
        // Capture starting balances
        BigDecimal aliceBefore = accounts.findById("alice@demo").orElseThrow().getBalance();
        BigDecimal bobBefore = accounts.findById("bob@demo").orElseThrow().getBalance();

        // One packet, delivered from 3 "bridges" simultaneously
        MeshPacket packet = demoService.createPacket(
                "alice@demo", "bob@demo", new BigDecimal("100.00"), "1234", 5);

        ExecutorService pool = Executors.newFixedThreadPool(3);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger settled = new AtomicInteger();
        AtomicInteger duplicates = new AtomicInteger();

        Future<?>[] futures = new Future[3];
        for (int i = 0; i < 3; i++) {
            final String node = "bridge-" + i;
            futures[i] = pool.submit(() -> {
                try {
                    start.await();
                    BridgeIngestionService.IngestResult r = bridge.ingest(packet, node, 3);
                    if ("SETTLED".equals(r.outcome())) settled.incrementAndGet();
                    else if ("DUPLICATE_DROPPED".equals(r.outcome())) duplicates.incrementAndGet();
                } catch (Exception e) { throw new RuntimeException(e); }
            });
        }

        start.countDown(); // release all 3 threads at once
        for (Future<?> f : futures) f.get(5, TimeUnit.SECONDS);
        pool.shutdown();

        assertEquals(1, settled.get(), "exactly one bridge should settle");
        assertEquals(2, duplicates.get(), "the other two should be duplicates");

        // Balance moved exactly once
        BigDecimal aliceAfter = accounts.findById("alice@demo").orElseThrow().getBalance();
        BigDecimal bobAfter = accounts.findById("bob@demo").orElseThrow().getBalance();
        assertEquals(aliceBefore.subtract(new BigDecimal("100.00")), aliceAfter);
        assertEquals(bobBefore.add(new BigDecimal("100.00")), bobAfter);
    }

    @Test
    void tamperedCiphertextIsRejected() throws Exception {
        MeshPacket packet = demoService.createPacket(
                "alice@demo", "bob@demo", new BigDecimal("50.00"), "1234", 5);

        // Flip a byte in the ciphertext
        char[] chars = packet.getCiphertext().toCharArray();
        chars[chars.length / 2] = chars[chars.length / 2] == 'A' ? 'B' : 'A';
        packet.setCiphertext(new String(chars));

        BridgeIngestionService.IngestResult r = bridge.ingest(packet, "bridge-x", 1);
        assertEquals("INVALID", r.outcome());
    }

    @Test
    void encryptDecryptRoundTrip() throws Exception {
        PaymentInstruction original = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("123.45"),
                "abcdef", "nonce-1", System.currentTimeMillis(),
                1L, "sig-sample", "pubkey-sample");

        String ct = crypto.encrypt(original, serverKey.getPublicKey());
        PaymentInstruction decrypted = crypto.decrypt(ct);

        assertEquals(original.getSenderVpa(), decrypted.getSenderVpa());
        assertEquals(original.getReceiverVpa(), decrypted.getReceiverVpa());
        assertEquals(0, original.getAmount().compareTo(decrypted.getAmount()));
        assertEquals(original.getNonce(), decrypted.getNonce());
        assertEquals(original.getSequenceNumber(), decrypted.getSequenceNumber());
    }

    @Test
    void forgedDeviceSignatureIsRejected() throws Exception {
        Account alice = accounts.findById("alice@demo").orElseThrow();
        long nextSeq = alice.getLastSequenceNumber() + 1;

        String forgedSig = Base64.getEncoder().encodeToString("FORGED_ADVERSARIAL_SIG".getBytes());
        MeshPacket forgedPacket = demoService.createCustomPacket(
                "alice@demo", "bob@demo", new BigDecimal("75.00"), "1234", 5, nextSeq, forgedSig);

        BridgeIngestionService.IngestResult r = bridge.ingest(forgedPacket, "adversary-node", 1);
        assertEquals("INVALID", r.outcome());
        assertEquals("invalid_device_signature", r.reason());
    }

    @Test
    void offlineDoubleSpendSequenceForkIsRejected() throws Exception {
        Account alice = accounts.findById("alice@demo").orElseThrow();
        long forkSeq = alice.getLastSequenceNumber() + 1;

        // Alice attempts an offline fork: signs TWO payments using the same monotonic sequence number
        MeshPacket pkt1 = demoService.createCustomPacket(
                "alice@demo", "bob@demo", new BigDecimal("40.00"), "1234", 5, forkSeq, null);
        MeshPacket pkt2 = demoService.createCustomPacket(
                "alice@demo", "carol@demo", new BigDecimal("40.00"), "1234", 5, forkSeq, null);

        // Upload first payment
        BridgeIngestionService.IngestResult r1 = bridge.ingest(pkt1, "bridge-alpha", 2);
        assertEquals("SETTLED", r1.outcome());

        // Upload second conflicting payment with the same sequence number
        BridgeIngestionService.IngestResult r2 = bridge.ingest(pkt2, "bridge-beta", 2);
        assertEquals("INVALID", r2.outcome());
        assertTrue(r2.reason().contains("settlement_rejected_by_ledger"));
    }
}
