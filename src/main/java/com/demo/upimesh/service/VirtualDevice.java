package com.demo.upimesh.service;

import com.demo.upimesh.model.MeshPacket;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A simulated phone in the mesh with physical spatial coordinates,
 * battery metrics, radio range calculation, and packet storage.
 */
public class VirtualDevice {

    private final String deviceId;
    private boolean hasInternet;
    private double x;
    private double y;
    private int batteryPercent;
    private String role;
    private final Map<String, MeshPacket> heldPackets = new ConcurrentHashMap<>();

    public VirtualDevice(String deviceId, boolean hasInternet) {
        this(deviceId, hasInternet, 0.0, 0.0, 85, "Relay");
    }

    public VirtualDevice(String deviceId, boolean hasInternet, double x, double y, int batteryPercent, String role) {
        this.deviceId = deviceId;
        this.hasInternet = hasInternet;
        this.x = x;
        this.y = y;
        this.batteryPercent = batteryPercent;
        this.role = role;
    }

    public String getDeviceId() { return deviceId; }
    public boolean hasInternet() { return hasInternet; }
    public void setHasInternet(boolean hasInternet) { this.hasInternet = hasInternet; }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }

    public double getY() { return y; }
    public void setY(double y) { this.y = y; }

    public int getBatteryPercent() { return batteryPercent; }
    public void setBatteryPercent(int batteryPercent) { this.batteryPercent = batteryPercent; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public void hold(MeshPacket packet) {
        heldPackets.putIfAbsent(packet.getPacketId(), packet);
    }

    public Collection<MeshPacket> getHeldPackets() {
        return heldPackets.values();
    }

    public boolean holds(String packetId) {
        return heldPackets.containsKey(packetId);
    }

    public int packetCount() {
        return heldPackets.size();
    }

    public void clear() {
        heldPackets.clear();
    }

    /**
     * Calculates Euclidean distance in simulated meters to another device.
     */
    public double distanceTo(VirtualDevice other) {
        double dx = this.x - other.x;
        double dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Estimates RSSI (Received Signal Strength Indicator) in dBm using the
     * Log-Distance Path Loss model for BLE 2.4 GHz propagation:
     *   RSSI(d) = RSSI_0 - 10 * n * log10(d)
     * where RSSI_0 = -45 dBm at 1m, and path loss exponent n = 2.2 for indoor environments.
     */
    public int calculateRssiDbm(VirtualDevice other) {
        double dist = Math.max(1.0, distanceTo(other) / 25.0); // normalize scale
        double rssi = -42.0 - (10.0 * 2.2 * Math.log10(dist));
        return (int) Math.round(rssi);
    }
}
