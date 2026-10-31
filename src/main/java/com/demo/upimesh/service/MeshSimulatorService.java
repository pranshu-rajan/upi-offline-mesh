package com.demo.upimesh.service;

import com.demo.upimesh.model.MeshPacket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simulates a dynamic Bluetooth Low Energy (BLE) store-and-forward mesh network.
 * Supports spatial coordinates, dynamic node mobility, signal attenuation (RSSI),
 * hop-by-hop TTL decrement, and multi-bridge concurrent upload collection.
 */
@Service
public class MeshSimulatorService {

    private static final Logger log = LoggerFactory.getLogger(MeshSimulatorService.class);
    private static final double MAX_BLE_COMMUNICATION_DISTANCE = 220.0; // Distance units in canvas space

    private final Map<String, VirtualDevice> devices = new ConcurrentHashMap<>();

    public MeshSimulatorService() {
        seedDefaultDevices();
    }

    private void seedDefaultDevices() {
        devices.put("phone-alice",     new VirtualDevice("phone-alice",     false, 130, 190, 89, "Sender"));
        devices.put("phone-bob",       new VirtualDevice("phone-bob",       false, 310, 195, 73, "Receiver"));
        devices.put("phone-stranger1", new VirtualDevice("phone-stranger1", false, 310, 90,  64, "Relay"));
        devices.put("phone-stranger2", new VirtualDevice("phone-stranger2", false, 320, 300, 78, "Relay"));
        devices.put("phone-stranger3", new VirtualDevice("phone-stranger3", false, 490, 195, 45, "Relay"));
        devices.put("phone-bridge",    new VirtualDevice("phone-bridge",    true,  680, 190, 92, "Bridge"));
    }

    public Collection<VirtualDevice> getDevices() {
        return devices.values();
    }

    public VirtualDevice getDevice(String id) {
        return devices.get(id);
    }

    /**
     * Updates spatial coordinates and connectivity status of a device.
     */
    public boolean moveDevice(String deviceId, double x, double y, Boolean hasInternet) {
        VirtualDevice dev = devices.get(deviceId);
        if (dev == null) return false;
        dev.setX(x);
        dev.setY(y);
        if (hasInternet != null) {
            dev.setHasInternet(hasInternet);
        }
        log.info("Device {} moved to ({}, {}), internet={}", deviceId, x, y, dev.hasInternet());
        return true;
    }

    /**
     * Sender drops a packet into the mesh by handing it to their own device.
     */
    public void inject(String senderDeviceId, MeshPacket packet) {
        VirtualDevice sender = devices.get(senderDeviceId);
        if (sender == null) throw new IllegalArgumentException("Unknown device: " + senderDeviceId);
        sender.hold(packet);
        log.info("Packet {} injected at {} (TTL={})",
                packet.getPacketId().substring(0, 8), senderDeviceId, packet.getTtl());
    }

    /**
     * One round of BLE gossip:
     * Devices broadcast packets to neighboring peers that are within physical
     * radio range (or all reachable peers in fast-forward simulation).
     * TTL is decremented per hop.
     */
    public GossipResult gossipOnce() {
        int transfers = 0;
        List<VirtualDevice> deviceList = new ArrayList<>(devices.values());

        // Snapshot held packets so propagation doesn't traverse infinite hops in a single round
        Map<String, List<MeshPacket>> snapshot = new HashMap<>();
        for (VirtualDevice d : deviceList) {
            snapshot.put(d.getDeviceId(), new ArrayList<>(d.getHeldPackets()));
        }

        for (VirtualDevice src : deviceList) {
            for (MeshPacket pkt : snapshot.get(src.getDeviceId())) {
                if (pkt.getTtl() <= 0) continue;
                for (VirtualDevice dst : deviceList) {
                    if (dst == src) continue;
                    if (dst.holds(pkt.getPacketId())) continue;

                    // Physical proximity check (allows close or relay nodes to gossip)
                    double distance = src.distanceTo(dst);
                    if (distance > MAX_BLE_COMMUNICATION_DISTANCE && !isDirectRelay(src.getDeviceId(), dst.getDeviceId())) {
                        continue;
                    }

                    MeshPacket copy = new MeshPacket();
                    copy.setPacketId(pkt.getPacketId());
                    copy.setTtl(pkt.getTtl() - 1);
                    copy.setCreatedAt(pkt.getCreatedAt());
                    copy.setCiphertext(pkt.getCiphertext());
                    dst.hold(copy);
                    transfers++;
                }
            }
        }

        log.info("Gossip round complete: {} packet transfers across mesh", transfers);
        return new GossipResult(transfers, snapshotMap());
    }

    private boolean isDirectRelay(String src, String dst) {
        // Fallback for fast-forward simulation topology links
        return (src.contains("stranger") && dst.contains("bridge")) ||
               (src.contains("alice") && dst.contains("stranger")) ||
               (src.contains("stranger") && dst.contains("stranger"));
    }

    public Map<String, Integer> snapshotMap() {
        Map<String, Integer> m = new LinkedHashMap<>();
        for (VirtualDevice d : devices.values()) {
            m.put(d.getDeviceId(), d.packetCount());
        }
        return m;
    }

    /**
     * Generates dynamic topology data including active wireless links,
     * spatial coordinates, battery levels, and estimated RSSI.
     */
    public Map<String, Object> getDynamicTopology() {
        List<Map<String, Object>> nodeList = new ArrayList<>();
        List<Map<String, Object>> activeLinks = new ArrayList<>();
        List<VirtualDevice> allDevs = new ArrayList<>(devices.values());

        for (VirtualDevice d : allDevs) {
            nodeList.add(Map.of(
                    "deviceId", d.getDeviceId(),
                    "role", d.getRole(),
                    "hasInternet", d.hasInternet(),
                    "x", d.getX(),
                    "y", d.getY(),
                    "battery", d.getBatteryPercent(),
                    "packetCount", d.packetCount(),
                    "packetIds", d.getHeldPackets().stream()
                            .map(p -> p.getPacketId().substring(0, Math.min(8, p.getPacketId().length())))
                            .toList()
            ));
        }

        for (int i = 0; i < allDevs.size(); i++) {
            for (int j = i + 1; j < allDevs.size(); j++) {
                VirtualDevice a = allDevs.get(i);
                VirtualDevice b = allDevs.get(j);
                double dist = a.distanceTo(b);
                if (dist <= MAX_BLE_COMMUNICATION_DISTANCE || isDirectRelay(a.getDeviceId(), b.getDeviceId())) {
                    activeLinks.add(Map.of(
                            "source", a.getDeviceId(),
                            "target", b.getDeviceId(),
                            "distance", Math.round(dist),
                            "rssiDbm", a.calculateRssiDbm(b)
                    ));
                }
            }
        }

        return Map.of(
                "nodes", nodeList,
                "links", activeLinks,
                "totalNodes", allDevs.size()
        );
    }

    /**
     * Returns all packets held by devices with internet.
     */
    public List<BridgeUpload> collectBridgeUploads() {
        List<BridgeUpload> out = new ArrayList<>();
        for (VirtualDevice d : devices.values()) {
            if (!d.hasInternet()) continue;
            for (MeshPacket pkt : d.getHeldPackets()) {
                out.add(new BridgeUpload(d.getDeviceId(), pkt));
            }
        }
        return out;
    }

    public void resetMesh() {
        devices.values().forEach(VirtualDevice::clear);
    }

    public record GossipResult(int transfers, Map<String, Integer> deviceCounts) {}
    public record BridgeUpload(String bridgeNodeId, MeshPacket packet) {}
}
