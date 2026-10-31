package com.demo.upimesh.model;

import jakarta.persistence.*;

import java.math.BigDecimal;

/**
 * Bank account entity representing a user's ledger state.
 * Includes monotonic sequence tracking and device public key for offline payment verification.
 */
@Entity
@Table(name = "accounts")
public class Account {

    @Id
    private String vpa; // Virtual Payment Address, e.g. "alice@demo"

    @Column(nullable = false)
    private String holderName;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;

    @Version  // Optimistic locking — prevents lost updates on concurrent transfers
    private Long version;

    /**
     * The sender's registered mobile device public key (ECDSA P-256 base64).
     * Used by the settlement engine to verify digital signatures on offline transactions.
     */
    @Column(length = 512)
    private String devicePublicKey;

    /**
     * Strictly monotonic counter tracking the last settled transaction sequence number.
     * Prevents offline double-spending and sequence replay forks.
     */
    @Column(nullable = false)
    private Long lastSequenceNumber = 0L;

    /**
     * Maximum authorized offline spending limit (simulating UPI Lite Offline limit).
     */
    @Column(precision = 19, scale = 2)
    private BigDecimal offlineLimit = new BigDecimal("5000.00");

    public Account() {}

    public Account(String vpa, String holderName, BigDecimal balance) {
        this.vpa = vpa;
        this.holderName = holderName;
        this.balance = balance;
        this.lastSequenceNumber = 0L;
        this.offlineLimit = new BigDecimal("5000.00");
    }

    public Account(String vpa, String holderName, BigDecimal balance, String devicePublicKey) {
        this.vpa = vpa;
        this.holderName = holderName;
        this.balance = balance;
        this.devicePublicKey = devicePublicKey;
        this.lastSequenceNumber = 0L;
        this.offlineLimit = new BigDecimal("5000.00");
    }

    public String getVpa() { return vpa; }
    public void setVpa(String vpa) { this.vpa = vpa; }

    public String getHolderName() { return holderName; }
    public void setHolderName(String holderName) { this.holderName = holderName; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public String getDevicePublicKey() { return devicePublicKey; }
    public void setDevicePublicKey(String devicePublicKey) { this.devicePublicKey = devicePublicKey; }

    public Long getLastSequenceNumber() { return lastSequenceNumber == null ? 0L : lastSequenceNumber; }
    public void setLastSequenceNumber(Long lastSequenceNumber) { this.lastSequenceNumber = lastSequenceNumber; }

    public BigDecimal getOfflineLimit() { return offlineLimit; }
    public void setOfflineLimit(BigDecimal offlineLimit) { this.offlineLimit = offlineLimit; }
}
