package com.demo.upimesh.service;

import com.demo.upimesh.crypto.DeviceCryptoService;
import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.KeyPair;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Helper service that:
 *   - seeds demo accounts on startup with registered device ECDSA public keys
 *   - simulates "sender phone creates a cryptographically signed & encrypted packet"
 */
@Service
public class DemoService {

    private static final Logger log = LoggerFactory.getLogger(DemoService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private HybridCryptoService crypto;
    @Autowired private DeviceCryptoService deviceCrypto;
    @Autowired private ServerKeyHolder serverKey;

    // Simulated local hardware keystores on sender devices
    private final Map<String, KeyPair> simulatedDeviceKeyStores = new ConcurrentHashMap<>();

    @PostConstruct
    public void seedAccounts() {
        seedAccountWithKey("alice@demo", "Alice", new BigDecimal("5000.00"));
        seedAccountWithKey("bob@demo",   "Bob",   new BigDecimal("1000.00"));
        seedAccountWithKey("carol@demo", "Carol", new BigDecimal("2500.00"));
        seedAccountWithKey("dave@demo",  "Dave",  new BigDecimal("500.00"));
        log.info("Initialized demo accounts with ECDSA device security keys");
    }

    private void seedAccountWithKey(String vpa, String holderName, BigDecimal balance) {
        KeyPair deviceKey = simulatedDeviceKeyStores.computeIfAbsent(vpa, k -> deviceCrypto.generateDeviceKeyPair());
        String pubKeyBase64 = deviceCrypto.encodeKey(deviceKey.getPublic());

        Account account = accounts.findById(vpa).orElse(null);
        if (account == null) {
            account = new Account(vpa, holderName, balance, pubKeyBase64);
            accounts.save(account);
        } else if (account.getDevicePublicKey() == null) {
            account.setDevicePublicKey(pubKeyBase64);
            accounts.save(account);
        }
    }

    /**
     * Simulates the sender's phone creating an offline payment packet:
     *   1. Fetches sender's local monotonic counter and increments it.
     *   2. Generates an ECDSA hardware signature using the device's private key.
     *   3. Constructs PaymentInstruction with nonce, timestamp, signature & public key.
     *   4. Encrypts with server's RSA-2048 public key via hybrid RSA-OAEP + AES-256-GCM.
     *   5. Wraps in a MeshPacket with TTL.
     */
    public MeshPacket createPacket(String senderVpa, String receiverVpa,
                                   BigDecimal amount, String pin, int ttl) throws Exception {
        return createPacketInternal(senderVpa, receiverVpa, amount, pin, ttl, null, null);
    }

    /**
     * Allows custom override of sequence number or signature for adversarial security tests.
     */
    public MeshPacket createCustomPacket(String senderVpa, String receiverVpa,
                                         BigDecimal amount, String pin, int ttl,
                                         Long customSeqNo, String customSignature) throws Exception {
        return createPacketInternal(senderVpa, receiverVpa, amount, pin, ttl, customSeqNo, customSignature);
    }

    private MeshPacket createPacketInternal(String senderVpa, String receiverVpa,
                                           BigDecimal amount, String pin, int ttl,
                                           Long overrideSeqNo, String overrideSignature) throws Exception {

        // Determine monotonic sequence number
        Account senderAccount = accounts.findById(senderVpa).orElse(null);
        long nextSeq = (overrideSeqNo != null)
                ? overrideSeqNo
                : (senderAccount != null ? senderAccount.getLastSequenceNumber() + 1 : 1L);

        String nonce = UUID.randomUUID().toString();
        long signedAt = Instant.now().toEpochMilli();

        // Sign with simulated device private key
        KeyPair deviceKey = simulatedDeviceKeyStores.computeIfAbsent(senderVpa, k -> deviceCrypto.generateDeviceKeyPair());
        String pubKeyBase64 = deviceCrypto.encodeKey(deviceKey.getPublic());

        String signature;
        if (overrideSignature != null) {
            signature = overrideSignature;
        } else {
            String canonical = deviceCrypto.buildCanonicalPayload(senderVpa, receiverVpa, amount, nextSeq, nonce, signedAt);
            signature = deviceCrypto.sign(canonical, deviceKey.getPrivate());
        }

        PaymentInstruction instruction = new PaymentInstruction(
                senderVpa,
                receiverVpa,
                amount,
                sha256Hex(pin),
                nonce,
                signedAt,
                nextSeq,
                signature,
                pubKeyBase64
        );

        String ciphertext = crypto.encrypt(instruction, serverKey.getPublicKey());

        MeshPacket packet = new MeshPacket();
        packet.setPacketId(UUID.randomUUID().toString());
        packet.setTtl(ttl);
        packet.setCreatedAt(signedAt);
        packet.setCiphertext(ciphertext);
        return packet;
    }

    public KeyPair getSimulatedDeviceKey(String vpa) {
        return simulatedDeviceKeyStores.get(vpa);
    }

    private String sha256Hex(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(input.getBytes());
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}
