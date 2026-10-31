package com.demo.upimesh.model;

import java.math.BigDecimal;

/**
 * The actual payment instruction. After the server decrypts MeshPacket.ciphertext,
 * it gets one of these.
 *
 * Critical fields for security:
 *   - nonce: a UUID unique to this payment intent.
 *   - signedAt: lets the server reject stale packets ("freshness window").
 *   - pinHash: simulated hash of the user's offline authorized PIN.
 *   - sequenceNumber: strictly monotonic counter per sender account; prevents
 *                     offline balance double-spending and sequence forks.
 *   - deviceSignature: cryptographic ECDSA (P-256) hardware signature over the
 *                      canonical payload, guaranteeing non-repudiation.
 *   - devicePublicKey: public key of the signing mobile device.
 */
public class PaymentInstruction {

    private String senderVpa;
    private String receiverVpa;
    private BigDecimal amount;
    private String pinHash;
    private String nonce;            // UUID, unique per payment intent
    private Long signedAt;           // epoch millis, when sender signed
    private Long sequenceNumber;     // Monotonic counter per sender device (prevents offline replay/fork)
    private String deviceSignature;  // Base64 ECDSA signature
    private String devicePublicKey;  // Base64 ECDSA public key

    public PaymentInstruction() {}

    public PaymentInstruction(String senderVpa, String receiverVpa, BigDecimal amount,
                              String pinHash, String nonce, Long signedAt) {
        this(senderVpa, receiverVpa, amount, pinHash, nonce, signedAt, null, null, null);
    }

    public PaymentInstruction(String senderVpa, String receiverVpa, BigDecimal amount,
                              String pinHash, String nonce, Long signedAt,
                              Long sequenceNumber, String deviceSignature, String devicePublicKey) {
        this.senderVpa = senderVpa;
        this.receiverVpa = receiverVpa;
        this.amount = amount;
        this.pinHash = pinHash;
        this.nonce = nonce;
        this.signedAt = signedAt;
        this.sequenceNumber = sequenceNumber;
        this.deviceSignature = deviceSignature;
        this.devicePublicKey = devicePublicKey;
    }

    public String getSenderVpa() { return senderVpa; }
    public void setSenderVpa(String senderVpa) { this.senderVpa = senderVpa; }

    public String getReceiverVpa() { return receiverVpa; }
    public void setReceiverVpa(String receiverVpa) { this.receiverVpa = receiverVpa; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getPinHash() { return pinHash; }
    public void setPinHash(String pinHash) { this.pinHash = pinHash; }

    public String getNonce() { return nonce; }
    public void setNonce(String nonce) { this.nonce = nonce; }

    public Long getSignedAt() { return signedAt; }
    public void setSignedAt(Long signedAt) { this.signedAt = signedAt; }

    public Long getSequenceNumber() { return sequenceNumber; }
    public void setSequenceNumber(Long sequenceNumber) { this.sequenceNumber = sequenceNumber; }

    public String getDeviceSignature() { return deviceSignature; }
    public void setDeviceSignature(String deviceSignature) { this.deviceSignature = deviceSignature; }

    public String getDevicePublicKey() { return devicePublicKey; }
    public void setDevicePublicKey(String devicePublicKey) { this.devicePublicKey = devicePublicKey; }
}
