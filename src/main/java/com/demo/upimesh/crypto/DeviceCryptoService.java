package com.demo.upimesh.crypto;

import com.demo.upimesh.model.PaymentInstruction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Provides hardware-grade cryptographic device signing and non-repudiation.
 * In a production offline payment network, each mobile phone contains a secure
 * hardware keystore (e.g., Android StrongBox / Apple Secure Enclave) holding an
 * ECDSA secp256r1 (NIST P-256) private key.
 *
 * Every offline payment instruction is signed locally before being wrapped into
 * the hybrid RSA-OAEP + AES-GCM envelope, ensuring that:
 *  1. An attacker or intermediate node cannot forge transactions under someone else's VPA.
 *  2. The sender cannot repudiate having authorized the transfer.
 *  3. Strict monotonic sequence numbers prevent offline sequence forks / double-spends.
 */
@Service
public class DeviceCryptoService {

    private static final Logger log = LoggerFactory.getLogger(DeviceCryptoService.class);
    private static final String EC_ALGORITHM = "EC";
    private static final String SIGNATURE_ALGORITHM = "SHA256withECDSA";
    private static final String EC_CURVE = "secp256r1";

    /**
     * Generates a device-level ECDSA (P-256) keypair.
     */
    public KeyPair generateDeviceKeyPair() {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance(EC_ALGORITHM);
            kpg.initialize(new ECGenParameterSpec(EC_CURVE), new SecureRandom());
            return kpg.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate EC keypair: " + e.getMessage(), e);
        }
    }

    /**
     * Constructs the canonical cryptographic string representation of an offline payment instruction.
     */
    public String buildCanonicalPayload(String senderVpa, String receiverVpa, BigDecimal amount,
                                        Long sequenceNumber, String nonce, Long signedAt) {
        return String.format("%s:%s:%s:%d:%s:%d",
                senderVpa == null ? "" : senderVpa.trim(),
                receiverVpa == null ? "" : receiverVpa.trim(),
                amount == null ? "0.00" : amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(),
                sequenceNumber == null ? 0L : sequenceNumber,
                nonce == null ? "" : nonce.trim(),
                signedAt == null ? 0L : signedAt
        );
    }

    /**
     * Signs the canonical payment payload with the sender's device private key.
     */
    public String sign(String canonicalPayload, PrivateKey privateKey) throws Exception {
        Signature ecdsa = Signature.getInstance(SIGNATURE_ALGORITHM);
        ecdsa.initSign(privateKey);
        ecdsa.update(canonicalPayload.getBytes(StandardCharsets.UTF_8));
        byte[] signatureBytes = ecdsa.sign();
        return Base64.getEncoder().encodeToString(signatureBytes);
    }

    /**
     * Verifies the ECDSA signature against the provided public key.
     */
    public boolean verify(String canonicalPayload, String signatureBase64, PublicKey publicKey) {
        try {
            Signature ecdsa = Signature.getInstance(SIGNATURE_ALGORITHM);
            ecdsa.initVerify(publicKey);
            ecdsa.update(canonicalPayload.getBytes(StandardCharsets.UTF_8));
            byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);
            return ecdsa.verify(signatureBytes);
        } catch (Exception e) {
            log.warn("ECDSA verification failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Verifies a full PaymentInstruction using the sender's registered public key.
     */
    public boolean verifyInstruction(PaymentInstruction instruction, String registeredPublicKeyBase64) {
        if (instruction == null || instruction.getDeviceSignature() == null) {
            return false;
        }
        String keyToUse = (registeredPublicKeyBase64 != null && !registeredPublicKeyBase64.isBlank())
                ? registeredPublicKeyBase64
                : instruction.getDevicePublicKey();

        if (keyToUse == null || keyToUse.isBlank()) {
            log.warn("No public key available to verify signature for {}", instruction.getSenderVpa());
            return false;
        }

        try {
            PublicKey pubKey = decodePublicKey(keyToUse);
            String canonical = buildCanonicalPayload(
                    instruction.getSenderVpa(),
                    instruction.getReceiverVpa(),
                    instruction.getAmount(),
                    instruction.getSequenceNumber(),
                    instruction.getNonce(),
                    instruction.getSignedAt()
            );
            return verify(canonical, instruction.getDeviceSignature(), pubKey);
        } catch (Exception e) {
            log.error("Error verifying instruction signature: {}", e.getMessage(), e);
            return false;
        }
    }

    public PublicKey decodePublicKey(String base64) throws Exception {
        byte[] bytes = Base64.getDecoder().decode(base64);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(bytes);
        KeyFactory kf = KeyFactory.getInstance(EC_ALGORITHM);
        return kf.generatePublic(spec);
    }

    public PrivateKey decodePrivateKey(String base64) throws Exception {
        byte[] bytes = Base64.getDecoder().decode(base64);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(bytes);
        KeyFactory kf = KeyFactory.getInstance(EC_ALGORITHM);
        return kf.generatePrivate(spec);
    }

    public String encodeKey(Key key) {
        return Base64.getEncoder().encodeToString(key.getEncoded());
    }
}

