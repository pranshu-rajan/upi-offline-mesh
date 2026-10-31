package com.demo.upimesh.service;

import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.model.Transaction;
import com.demo.upimesh.model.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Where the ledger update happens. Wrapped in a DB transaction so either
 * BOTH the debit and credit happen, or neither does.
 *
 * Security & Integrity protections:
 *  1. @Version optimistic locking prevents lost updates on concurrent transfers.
 *  2. Monotonic sequence counter check prevents offline sequence forks / double-spending.
 *  3. Offline limit validation (simulating pre-authorized offline balance ceilings).
 */
@Service
public class SettlementService {

    private static final Logger log = LoggerFactory.getLogger(SettlementService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private TransactionRepository transactions;

    @Transactional
    public Transaction settle(PaymentInstruction instruction, String packetHash,
                              String bridgeNodeId, int hopCount) {

        Account sender = accounts.findById(instruction.getSenderVpa())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown sender VPA: " + instruction.getSenderVpa()));

        Account receiver = accounts.findById(instruction.getReceiverVpa())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown receiver VPA: " + instruction.getReceiverVpa()));

        BigDecimal amount = instruction.getAmount();
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. Offline Limit Enforcement
        if (sender.getOfflineLimit() != null && amount.compareTo(sender.getOfflineLimit()) > 0) {
            log.warn("Offline limit exceeded: {} tried to transfer ₹{} (Limit: ₹{})",
                    sender.getVpa(), amount, sender.getOfflineLimit());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "EXCEEDS_OFFLINE_LIMIT");
        }

        // 2. Monotonic Sequence Verification (Double-Spending / Sequence Replay Fork Protection)
        if (instruction.getSequenceNumber() != null && sender.getLastSequenceNumber() != null) {
            if (instruction.getSequenceNumber() <= sender.getLastSequenceNumber()) {
                log.warn("Sequence replay/fork detected: Sender {} current seq={} <= settled seq={}",
                        sender.getVpa(), instruction.getSequenceNumber(), sender.getLastSequenceNumber());
                return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "SEQUENCE_REPLAY_FORK");
            }
        }

        // 3. Balance Check
        if (sender.getBalance().compareTo(amount) < 0) {
            log.warn("Insufficient balance: {} has ₹{}, tried to send ₹{}",
                    sender.getVpa(), sender.getBalance(), amount);
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "INSUFFICIENT_FUNDS");
        }

        // 4. Update balances and monotonic counter
        sender.setBalance(sender.getBalance().subtract(amount));
        receiver.setBalance(receiver.getBalance().add(amount));

        if (instruction.getSequenceNumber() != null) {
            sender.setLastSequenceNumber(instruction.getSequenceNumber());
        }

        accounts.save(sender);
        accounts.save(receiver);

        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setSenderVpa(instruction.getSenderVpa());
        tx.setReceiverVpa(instruction.getReceiverVpa());
        tx.setAmount(amount);
        tx.setSignedAt(Instant.ofEpochMilli(instruction.getSignedAt()));
        tx.setSettledAt(Instant.now());
        tx.setBridgeNodeId(bridgeNodeId);
        tx.setHopCount(hopCount);
        tx.setStatus(Transaction.Status.SETTLED);
        transactions.save(tx);

        log.info("SETTLED ₹{} from {} to {} (seq={}, packetHash={}, bridge={}, hops={})",
                amount, sender.getVpa(), receiver.getVpa(), instruction.getSequenceNumber(),
                packetHash.substring(0, 12) + "...", bridgeNodeId, hopCount);

        return tx;
    }

    private Transaction recordRejected(PaymentInstruction instruction, String packetHash,
                                       String bridgeNodeId, int hopCount, String reason) {
        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setSenderVpa(instruction.getSenderVpa());
        tx.setReceiverVpa(instruction.getReceiverVpa());
        tx.setAmount(instruction.getAmount());
        tx.setSignedAt(Instant.ofEpochMilli(instruction.getSignedAt()));
        tx.setSettledAt(Instant.now());
        tx.setBridgeNodeId(bridgeNodeId);
        tx.setHopCount(hopCount);
        tx.setStatus(Transaction.Status.REJECTED);
        return transactions.save(tx);
    }
}
