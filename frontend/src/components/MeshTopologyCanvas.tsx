"use client";

import React, { useState } from "react";
import {
  Wifi,
  Smartphone,
  Radio,
  Battery,
  Layers,
  ArrowRight,
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
  theme?: "light" | "dark";
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
  theme = "light",
}: MeshTopologyCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const isDark = theme === "dark";

  // Node spatial layout coordinates (Canvas dimensions: 800 x 380)
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
      y: 300,
      label: "Stranger #2",
      role: "Relay",
      battery: 78,
      rssi: "-72 dBm",
    },
    "phone-stranger3": {
      x: 490,
      y: 195,
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
      y: 195,
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
    <div className={`glass-panel rounded-3xl p-6 border shadow-lg space-y-4 relative overflow-hidden transition-all duration-200 ${
      isDark
        ? "bg-slate-900/70 border-slate-800 text-slate-100"
        : "bg-white/85 border-slate-200/90 text-slate-900 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]"
    }`}>
      {/* Background ambient radial bloom */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full blur-3xl pointer-events-none ${
        isDark
          ? "bg-cyan-500/5 via-indigo-500/5 to-emerald-500/5"
          : "bg-indigo-500/5 via-sky-500/5 to-emerald-500/5"
      }`} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm ${
              isDark
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-indigo-50 border-indigo-200/80 text-indigo-600"
            }`}>
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm tracking-tight">
                  Decentralized Bluetooth Mesh Network Topology
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${
                  isDark
                    ? "bg-cyan-950/80 text-cyan-400 border-cyan-800/80"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                }`}>
                  BLE Multi-Hop Gossip
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Real-time peer discovery, store-and-forward packet routing, and 4G bridge egress
              </p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className={`flex items-center space-x-3 text-[11px] px-3 py-1.5 rounded-xl border ${
          isDark
            ? "bg-slate-950/80 border-slate-800 text-slate-400"
            : "bg-slate-100/80 border-slate-200/80 text-slate-600"
        }`}>
          <span className="flex items-center space-x-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isDark ? "bg-cyan-400 ring-2 ring-cyan-950" : "bg-indigo-600 ring-2 ring-indigo-200"}`} />
            <span className={isDark ? "text-slate-300 font-medium" : "font-medium text-slate-700"}>Sender</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span>Relay Phone</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isDark ? "bg-emerald-400 ring-2 ring-emerald-950" : "bg-emerald-500 ring-2 ring-emerald-200"}`} />
            <span className={isDark ? "text-emerald-400 font-semibold" : "font-semibold text-emerald-700"}>4G Bridge</span>
          </span>
        </div>
      </div>

      {/* SVG Mesh Visualization Canvas */}
      <div className={`relative w-full mesh-canvas-bg rounded-2xl border overflow-hidden min-h-[380px] flex items-center justify-center transition-colors ${
        isDark ? "border-slate-800/90 shadow-2xl" : "border-slate-200/80 shadow-inner"
      }`}>
        <svg
          viewBox="0 0 800 380"
          className="w-full h-full max-h-[380px] select-none"
        >
          <defs>
            {/* Glowing particle filter */}
            <filter id="glowLight" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={isDark ? "#38bdf8" : "#4f46e5"} floodOpacity={isDark ? "0.8" : "0.4"} />
            </filter>

            {/* Node elevation drop shadow */}
            <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity={isDark ? "0.4" : "0.08"} />
            </filter>
          </defs>

          {/* 1. Network Connection Links */}
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
                  stroke={isDark ? "#334155" : "#cbd5e1"}
                  strokeWidth="1.75"
                  strokeDasharray="4 4"
                />

                {/* Animated Packet Flow Particles during Gossip Round */}
                {isGossiping && (
                  <circle r="4.5" fill={isDark ? "#38bdf8" : "#4f46e5"} filter="url(#glowLight)">
                    <animateMotion
                      path={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
                      dur={`${1.1 + (idx % 3) * 0.35}s`}
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
            const isSender = device.deviceId === "phone-alice";

            return (
              <g
                key={device.deviceId}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => {
                  setSelectedNode(device.deviceId);
                  if (onSelectDevice) onSelectDevice(device.deviceId);
                }}
              >
                {/* Radio ripple ring if holding packets */}
                {hasPackets && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="34"
                    fill="none"
                    stroke={isBridge ? (isDark ? "#34d399" : "#059669") : (isDark ? "#38bdf8" : "#4f46e5")}
                    strokeWidth="1.5"
                    opacity={isDark ? "0.6" : "0.35"}
                    className="animate-ping"
                  />
                )}

                {/* Outer selection ring */}
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="29"
                    fill="none"
                    stroke={isDark ? "#38bdf8" : "#4f46e5"}
                    strokeWidth="2.5"
                    strokeDasharray="3 3"
                    className="animate-pulse-slow"
                  />
                )}

                {/* Node Body Circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="23"
                  fill={isDark ? "#0f172a" : "#ffffff"}
                  filter="url(#nodeShadow)"
                  stroke={
                    isBridge
                      ? (isDark ? "#10b981" : "#059669")
                      : isSender
                      ? (isDark ? "#38bdf8" : "#4f46e5")
                      : hasPackets
                      ? (isDark ? "#818cf8" : "#6366f1")
                      : (isDark ? "#475569" : "#94a3b8")
                  }
                  strokeWidth={hasPackets || isBridge || isSender ? "2.5" : "1.75"}
                />

                {/* Inner Ambient Accent Ring */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="19"
                  fill={
                    isBridge
                      ? (isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)")
                      : isSender
                      ? (isDark ? "rgba(56, 189, 248, 0.15)" : "rgba(99, 102, 241, 0.08)")
                      : hasPackets
                      ? (isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.06)")
                      : (isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(241, 245, 249, 0.6)")
                  }
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
                      <Wifi className={`w-4 h-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                    ) : (
                      <Smartphone
                        className={`w-4 h-4 ${
                          isSender
                            ? (isDark ? "text-cyan-400" : "text-indigo-600")
                            : hasPackets
                            ? (isDark ? "text-indigo-400" : "text-indigo-500")
                            : (isDark ? "text-slate-400" : "text-slate-500")
                        }`}
                      />
                    )}
                  </div>
                </foreignObject>

                {/* Packet Count Badge */}
                {hasPackets && (
                  <g>
                    <circle
                      cx={pos.x + 15}
                      cy={pos.y - 15}
                      r="10"
                      fill="#e11d48"
                      stroke={isDark ? "#0f172a" : "#ffffff"}
                      strokeWidth="2"
                      filter="url(#nodeShadow)"
                    />
                    <text
                      x={pos.x + 15}
                      y={pos.y - 11.5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9.5"
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
                  y={pos.y + 38}
                  textAnchor="middle"
                  fill={isSelected ? (isDark ? "#38bdf8" : "#4f46e5") : (isDark ? "#f1f5f9" : "#0f172a")}
                  fontSize="11.5"
                  fontWeight="600"
                  fontFamily="sans-serif"
                >
                  {device.deviceId}
                </text>

                {/* Connectivity subtext */}
                <text
                  x={pos.x}
                  y={pos.y + 51}
                  textAnchor="middle"
                  fill={isBridge ? (isDark ? "#34d399" : "#059669") : (isDark ? "#94a3b8" : "#64748b")}
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {isBridge ? "• 4G GATEWAY" : "BLE OFFLINE"}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Node Telemetry HUD Drawer */}
        {selectedNode && activeDeviceData && activeMeta && (
          <div className={`absolute bottom-4 left-4 p-4 rounded-2xl border shadow-xl max-w-xs text-xs space-y-2.5 z-20 transition-all duration-200 backdrop-blur-xl ${
            isDark
              ? "bg-slate-900/95 border-slate-700 text-slate-200"
              : "bg-white/95 border-indigo-200/90 text-slate-700 shadow-xl"
          }`}>
            <div className={`flex items-center justify-between border-b pb-2 ${isDark ? "border-slate-800 text-white" : "border-slate-100 text-slate-900"}`}>
              <div className="flex items-center space-x-2 font-bold">
                <Smartphone className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-indigo-600"}`} />
                <span>{selectedNode}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className={`text-xs px-1.5 py-0.5 rounded cursor-pointer ${isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Role: <strong className={isDark ? "text-white" : "text-slate-900"}>{activeMeta.role}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-slate-400" />
                <span>RSSI: <strong className={isDark ? "text-white" : "text-slate-900"}>{activeMeta.rssi}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Battery className="w-3.5 h-3.5 text-emerald-500" />
                <span>Battery: <strong className={isDark ? "text-white" : "text-slate-900"}>{activeMeta.battery}%</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                {activeDeviceData.hasInternet ? (
                  <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                    <Wifi className="w-3 h-3" />
                    <span>4G Live</span>
                  </span>
                ) : (
                  <span className="text-slate-400 font-semibold flex items-center space-x-1">
                    <Radio className="w-3 h-3 text-slate-400" />
                    <span>BLE Mesh</span>
                  </span>
                )}
              </div>
            </div>

            {/* Held Packets Queue */}
            <div className={`pt-1.5 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <span className="text-slate-400 text-[10px] font-semibold block mb-1">
                Held Packet Buffer ({activeDeviceData.packetCount}):
              </span>
              {activeDeviceData.packetIds && activeDeviceData.packetIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {activeDeviceData.packetIds.map((id, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-semibold ${
                        isDark
                          ? "bg-cyan-950/80 border-cyan-800 text-cyan-300"
                          : "bg-indigo-50 border-indigo-200 text-indigo-700"
                      }`}
                    >
                      #{id}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic">No packets buffered in storage</p>
              )}
            </div>

            {/* Quick Action Hint */}
            <div className={`pt-1 text-[10px] font-medium flex items-center justify-between ${isDark ? "text-cyan-400" : "text-indigo-600"}`}>
              <span>Selected as source device</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
