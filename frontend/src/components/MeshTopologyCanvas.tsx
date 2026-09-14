"use client";

import React, { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  Smartphone,
  Radio,
  Battery,
  Layers,
  Shield,
  Zap,
} from "lucide-react";

interface Device {
  deviceId: string;
  hasInternet: boolean;
  packetCount: number;
  packetIds: string[];
}

interface MeshTopologyCanvasProps {
  devices: Device[];
  isGossiping: boolean;
  onSelectDevice?: (deviceId: string) => void;
}

interface NodeCoord {
  x: number;
  y: number;
  label: string;
  role: "Sender" | "Relay" | "Bridge" | "Receiver";
  battery: number;
  rssi: string;
}

export default function MeshTopologyCanvas({
  devices,
  isGossiping,
  onSelectDevice,
}: MeshTopologyCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [animatingParticles, setAnimatingParticles] = useState<boolean>(false);

  // Trigger packet animation when gossip happens
  useEffect(() => {
    if (isGossiping) {
      setAnimatingParticles(true);
      const t = setTimeout(() => setAnimatingParticles(false), 2400);
      return () => clearTimeout(t);
    }
  }, [isGossiping]);

  // Node spatial layout coordinates (Canvas dimensions: 800 x 420)
  const nodePositions: Record<string, NodeCoord> = {
    "phone-alice": {
      x: 130,
      y: 190,
      label: "Alice (Sender)",
      role: "Sender",
      battery: 89,
      rssi: "-54 dBm",
    },
    "phone-stranger1": {
      x: 310,
      y: 90,
      label: "Stranger #1",
      role: "Relay",
      battery: 64,
      rssi: "-68 dBm",
    },
    "phone-stranger2": {
      x: 320,
      y: 310,
      label: "Stranger #2",
      role: "Relay",
      battery: 78,
      rssi: "-72 dBm",
    },
    "phone-stranger3": {
      x: 490,
      y: 200,
      label: "Stranger #3",
      role: "Relay",
      battery: 45,
      rssi: "-61 dBm",
    },
    "phone-bridge": {
      x: 680,
      y: 190,
      label: "Bridge (4G)",
      role: "Bridge",
      battery: 92,
      rssi: "-48 dBm",
    },
    "phone-bob": {
      x: 310,
      y: 200,
      label: "Bob (Receiver)",
      role: "Receiver",
      battery: 73,
      rssi: "-58 dBm",
    },
  };

  // Mesh connectivity graph links (Source -> Target pairs)
  const meshLinks = [
    { from: "phone-alice", to: "phone-stranger1" },
    { from: "phone-alice", to: "phone-bob" },
    { from: "phone-alice", to: "phone-stranger2" },
    { from: "phone-stranger1", to: "phone-stranger3" },
    { from: "phone-stranger2", to: "phone-stranger3" },
    { from: "phone-bob", to: "phone-stranger3" },
    { from: "phone-stranger3", to: "phone-bridge" },
    { from: "phone-stranger1", to: "phone-bridge" },
  ];

  const activeDeviceData = devices.find((d) => d.deviceId === selectedNode);
  const activeMeta = selectedNode ? nodePositions[selectedNode] : null;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            <h3 className="font-semibold text-sm text-slate-100">
              Live Bluetooth Mesh Network Topology
            </h3>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono">
              BLE GATT Hop Visualizer
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time peer discovery, multi-hop gossip links, and packet propagation
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>Sender</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span>Relay Phone</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>4G Bridge</span>
          </span>
        </div>
      </div>

      {/* SVG Mesh Visualization Canvas */}
      <div className="relative w-full bg-slate-950/70 rounded-xl border border-slate-900 overflow-hidden min-h-[340px] flex items-center justify-center">
        <svg
          viewBox="0 0 800 380"
          className="w-full h-full max-h-[380px] select-none"
        >
          <defs>
            {/* Gradient for links */}
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
            </linearGradient>

            {/* Glowing particle filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. Connection Links */}
          {meshLinks.map((link, idx) => {
            const start = nodePositions[link.from];
            const end = nodePositions[link.to];
            if (!start || !end) return null;

            return (
              <g key={idx}>
                {/* Passive line */}
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="rgba(71, 85, 105, 0.35)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Animated Packet Flow Particles during Gossip */}
                {animatingParticles && (
                  <circle r="4" fill="#38bdf8" filter="url(#glow)">
                    <animateMotion
                      path={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
                      dur={`${1.2 + (idx % 3) * 0.4}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* 2. Device Nodes */}
          {devices.map((device) => {
            const pos = nodePositions[device.deviceId] || {
              x: 400,
              y: 200,
              label: device.deviceId,
              role: "Relay" as const,
              battery: 50,
              rssi: "-65 dBm",
            };

            const isBridge = device.hasInternet;
            const hasPackets = device.packetCount > 0;
            const isSelected = selectedNode === device.deviceId;

            return (
              <g
                key={device.deviceId}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => {
                  setSelectedNode(device.deviceId);
                  if (onSelectDevice) onSelectDevice(device.deviceId);
                }}
              >
                {/* Radio ripple effect if holding packets */}
                {hasPackets && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="34"
                    fill="none"
                    stroke={isBridge ? "#10b981" : "#6366f1"}
                    strokeWidth="1"
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}

                {/* Outer selection ring */}
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="28"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Node Body Circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="22"
                  fill={isBridge ? "#064e3b" : "#1e1b4b"}
                  stroke={
                    isBridge
                      ? "#10b981"
                      : hasPackets
                      ? "#818cf8"
                      : "#475569"
                  }
                  strokeWidth={hasPackets ? "2.5" : "1.5"}
                />

                {/* Node Icon Graphic */}
                <foreignObject
                  x={pos.x - 11}
                  y={pos.y - 11}
                  width="22"
                  height="22"
                  className="pointer-events-none"
                >
                  <div className="w-full h-full flex items-center justify-center">
                    {isBridge ? (
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5 text-indigo-300" />
                    )}
                  </div>
                </foreignObject>

                {/* Packet Count Badge (Top-Right of Node) */}
                {hasPackets && (
                  <g>
                    <circle
                      cx={pos.x + 14}
                      cy={pos.y - 14}
                      r="9"
                      fill="#ef4444"
                      className="animate-pulse"
                    />
                    <text
                      x={pos.x + 14}
                      y={pos.y - 11}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {device.packetCount}
                    </text>
                  </g>
                )}

                {/* Node Label Below */}
                <text
                  x={pos.x}
                  y={pos.y + 36}
                  textAnchor="middle"
                  fill={isSelected ? "#38bdf8" : "#94a3b8"}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="sans-serif"
                >
                  {device.deviceId}
                </text>

                {/* Connectivity subtext */}
                <text
                  x={pos.x}
                  y={pos.y + 48}
                  textAnchor="middle"
                  fill={isBridge ? "#34d399" : "#64748b"}
                  fontSize="9"
                  fontWeight="500"
                  fontFamily="monospace"
                >
                  {isBridge ? "• 4G ONLINE" : "OFFLINE"}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Node Telemetry HUD Drawer (Bottom Left Floating Panel) */}
        {selectedNode && activeDeviceData && activeMeta && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md p-3.5 rounded-xl border border-indigo-500/30 shadow-xl max-w-xs text-xs space-y-2 z-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>{selectedNode}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-300 text-xs px-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono">
              <div>
                <span className="text-slate-500">Role:</span> {activeMeta.role}
              </div>
              <div>
                <span className="text-slate-500">Signal:</span> {activeMeta.rssi}
              </div>
              <div>
                <span className="text-slate-500">Battery:</span> {activeMeta.battery}%
              </div>
              <div>
                <span className="text-slate-500">Network:</span>{" "}
                {activeDeviceData.hasInternet ? (
                  <span className="text-emerald-400">4G Active</span>
                ) : (
                  <span className="text-slate-400">BLE Mesh</span>
                )}
              </div>
            </div>

            {/* Held Packets */}
            <div className="pt-1">
              <span className="text-slate-500 text-[10px] block mb-1">
                Held Packet Buffer ({activeDeviceData.packetCount}):
              </span>
              {activeDeviceData.packetIds && activeDeviceData.packetIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {activeDeviceData.packetIds.map((id, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-mono text-[10px]"
                    >
                      #{id}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-600 italic">Buffer empty</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
