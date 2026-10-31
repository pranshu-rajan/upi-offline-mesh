package com.demo.upimesh.controller;

import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.model.*;
import com.demo.upimesh.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * Public REST surface for the UPI Offline Mesh settlement engine & simulator.
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiController {

    @Autowired private ServerKeyHolder serverKey;
    @Autowired private DemoService demo;
    @Autowired private MeshSimulatorService mesh;
    @Autowired private BridgeIngestionService bridge;
    @Autowired private AccountRepository accountRepo;
    @Autowired private TransactionRepository txRepo;
    @Autowired private IdempotencyService idempotency;

    // ------------------------------------------------------------------ key

    @GetMapping("/server-key")
    public Map<String, String> getServerPublicKey() {
        return Map.of(
                "publicKey", serverKey.getPublicKeyBase64(),
                "algorithm", "RSA-2048 / OAEP-SHA256",
                "deviceSignatureScheme", "ECDSA secp256r1 (SHA256withECDSA)",
                "hybridScheme", "RSA-OAEP encrypts an ephemeral AES-256-GCM session key"
        );
    }

    // ---------------------------------------------------------------- demo

    /**
     * Demo helper: build a cryptographically signed packet on the sender phone
     * and inject it into the mesh at the given device.
     */
    @PostMapping("/demo/send")
    public ResponseEntity<?> demoSend(@RequestBody DemoSendRequest req) throws Exception {
        MeshPacket packet = demo.createPacket(
                req.senderVpa, req.receiverVpa, req.amount, req.pin,
                req.ttl == null ? 5 : req.ttl);

        String startDevice = req.startDevice == null ? "phone-alice" : req.startDevice;
        mesh.inject(startDevice, packet);

        return ResponseEntity.ok(Map.of(
                "packetId", packet.getPacketId(),
                "ciphertextPreview", packet.getCiphertext().substring(0, Math.min(64, packet.getCiphertext().length())) + "...",
                "ttl", packet.getTtl(),
                "injectedAt", startDevice
        ));
    }

    public static class DemoSendRequest {
        public String senderVpa;
        public String receiverVpa;
        public BigDecimal amount;
        public String pin;
        public Integer ttl;
        public String startDevice;
    }

    /**
     * Security Attack Simulation: Offline Double-Spending / Sequence Replay Fork Attack.
     * Alice attempts to sign TWO different payments using the exact same monotonic sequence number.
     * The settlement engine will settle the first and reject the second with SEQUENCE_REPLAY_FORK.
     */
    @PostMapping("/demo/double-spend-attack")
    public ResponseEntity<?> demoDoubleSpendAttack() throws Exception {
        Account alice = accountRepo.findById("alice@demo").orElseThrow();
        long attackSeq = alice.getLastSequenceNumber() + 1;

        // Packet 1: Alice pays Bob ₹200 with sequence attackSeq
        MeshPacket pkt1 = demo.createCustomPacket(
                "alice@demo", "bob@demo", new BigDecimal("200.00"), "1234", 5, attackSeq, null);

        // Packet 2: Alice attempts to spend the SAME offline sequence paying Carol ₹200
        MeshPacket pkt2 = demo.createCustomPacket(
                "alice@demo", "carol@demo", new BigDecimal("200.00"), "1234", 5, attackSeq, null);

        // Upload packet 1
        BridgeIngestionService.IngestResult res1 = bridge.ingest(pkt1, "bridge-node-1", 2);

        // Upload conflicting packet 2 with same sequence number
        BridgeIngestionService.IngestResult res2 = bridge.ingest(pkt2, "bridge-node-2", 2);

        return ResponseEntity.ok(Map.of(
                "firstAttempt", Map.of(
                        "packetId", pkt1.getPacketId(),
                        "outcome", res1.outcome(),
                        "reason", res1.reason() == null ? "SUCCESS" : res1.reason()
                ),
                "secondConflictingAttempt", Map.of(
                        "packetId", pkt2.getPacketId(),
                        "outcome", res2.outcome(),
                        "reason", res2.reason() == null ? "" : res2.reason()
                ),
                "explanation", "Second payment rejected due to monotonic sequence counter check, neutralizing the offline double-spending attack!"
        ));
    }

    /**
     * Security Attack Simulation: Forged Device Signature Attack.
     * Simulates an adversarial node injecting an instruction with a corrupted or forged ECDSA signature.
     */
    @PostMapping("/demo/forged-signature-attack")
    public ResponseEntity<?> demoForgedSignatureAttack() throws Exception {
        Account alice = accountRepo.findById("alice@demo").orElseThrow();
        long nextSeq = alice.getLastSequenceNumber() + 1;

        // Create packet with completely bogus signature string
        String fakeSignature = Base64.getEncoder().encodeToString("FORGED_ADVERSARIAL_DEVICE_SIGNATURE".getBytes());
        MeshPacket packet = demo.createCustomPacket(
                "alice@demo", "bob@demo", new BigDecimal("350.00"), "1234", 5, nextSeq, fakeSignature);

        BridgeIngestionService.IngestResult r = bridge.ingest(packet, "rogue-mesh-node", 1);
        return ResponseEntity.ok(Map.of(
                "packetId", packet.getPacketId(),
                "outcome", r.outcome(),
                "reason", r.reason() == null ? "" : r.reason(),
                "defenseMechanism", "ECDSA P-256 Device Hardware Non-Repudiation Check"
        ));
    }

    // -------------------------------------------------------------- mesh sim

    @GetMapping("/mesh/state")
    public Map<String, Object> meshState() {
        List<Map<String, Object>> deviceData = new ArrayList<>();
        for (VirtualDevice d : mesh.getDevices()) {
            deviceData.add(Map.of(
                    "deviceId", d.getDeviceId(),
                    "role", d.getRole(),
                    "hasInternet", d.hasInternet(),
                    "packetCount", d.packetCount(),
                    "battery", d.getBatteryPercent(),
                    "x", d.getX(),
                    "y", d.getY(),
                    "packetIds", d.getHeldPackets().stream()
                            .map(p -> p.getPacketId().substring(0, Math.min(8, p.getPacketId().length())))
                            .toList()
            ));
        }
        return Map.of(
                "devices", deviceData,
                "idempotencyCacheSize", idempotency.size()
        );
    }

    @GetMapping("/mesh/topology")
    public Map<String, Object> meshTopology() {
        return mesh.getDynamicTopology();
    }

    @PostMapping("/mesh/move-device")
    public ResponseEntity<?> moveDevice(@RequestBody Map<String, Object> body) {
        String deviceId = (String) body.get("deviceId");
        Number x = (Number) body.get("x");
        Number y = (Number) body.get("y");
        Boolean hasInternet = (Boolean) body.get("hasInternet");

        if (deviceId == null || x == null || y == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "deviceId, x, and y are required"));
        }
        boolean ok = mesh.moveDevice(deviceId, x.doubleValue(), y.doubleValue(), hasInternet);
        return ResponseEntity.ok(Map.of("updated", ok, "deviceId", deviceId));
    }

    @PostMapping("/mesh/gossip")
    public Map<String, Object> meshGossip() {
        MeshSimulatorService.GossipResult r = mesh.gossipOnce();
        return Map.of(
                "transfers", r.transfers(),
                "deviceCounts", r.deviceCounts()
        );
    }

    @PostMapping("/mesh/flush")
    public Map<String, Object> meshFlush() {
        List<MeshSimulatorService.BridgeUpload> uploads = mesh.collectBridgeUploads();

        List<Map<String, Object>> results = new ArrayList<>();
        uploads.parallelStream().forEach(up -> {
            BridgeIngestionService.IngestResult r =
                    bridge.ingest(up.packet(), up.bridgeNodeId(), 5 - up.packet().getTtl());
            synchronized (results) {
                results.add(Map.of(
                        "bridgeNode", up.bridgeNodeId(),
                        "packetId", up.packet().getPacketId().substring(0, Math.min(8, up.packet().getPacketId().length())),
                        "outcome", r.outcome(),
                        "reason", r.reason() == null ? "" : r.reason(),
                        "transactionId", r.transactionId() == null ? -1 : r.transactionId()
                ));
            }
        });

        return Map.of(
                "uploadsAttempted", uploads.size(),
                "results", results
        );
    }

    @PostMapping("/mesh/reset")
    public Map<String, Object> meshReset() {
        mesh.resetMesh();
        idempotency.clear();
        return Map.of("status", "mesh and idempotency cache cleared");
    }

    // -------------------------------------------------------------- bridge

    @PostMapping("/bridge/ingest")
    public ResponseEntity<?> ingest(
            @RequestBody MeshPacket packet,
            @RequestHeader(value = "X-Bridge-Node-Id", defaultValue = "unknown") String bridgeNodeId,
            @RequestHeader(value = "X-Hop-Count", defaultValue = "0") int hopCount) {

        BridgeIngestionService.IngestResult r = bridge.ingest(packet, bridgeNodeId, hopCount);
        return ResponseEntity.ok(r);
    }

    // ------------------------------------------------------------- accounts

    @GetMapping("/accounts")
    public List<Account> listAccounts() {
        return accountRepo.findAll();
    }

    @GetMapping("/transactions")
    public List<Transaction> listTransactions() {
        return txRepo.findTop20ByOrderByIdDesc();
    }
}
