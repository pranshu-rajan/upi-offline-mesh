"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Wifi,
  Smartphone,
  Radio,
  Battery,
  Layers,
  ArrowRight,
  Signal,
  Move,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";
import { sounds } from "./SoundEffects";
import { Device } from "@/types/mesh";

interface MeshTopologyCanvasProps {
  devices: Device[];
  isGossiping: boolean;
  onSelectDevice?: (deviceId: string) => void;
  onDeviceMove?: (deviceId: string, x: number, y: number) => void;
  theme?: "light" | "dark";
}

interface NodeState {
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
  onDeviceMove,
  theme = "light",
}: MeshTopologyCanvasProps) {
  const isDark = theme === "dark";
  const [selectedNode, setSelectedNode] = useState<string | null>("phone-alice");
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

  // Dynamic interactive node coordinates
  const [positions, setPositions] = useState<Record<string, NodeState>>({
    "phone-alice": {
      x: 120,
      y: 190,
      label: "Alice (Sender)",
      role: "Sender",
      battery: 89,
      rssi: "-54 dBm",
    },
    "phone-bob": {
      x: 280,
      y: 280,
      label: "Bob (Receiver)",
      role: "Receiver",
      battery: 73,
      rssi: "-58 dBm",
    },
    "phone-stranger1": {
      x: 280,
      y: 100,
      label: "Stranger #1",
      role: "Relay",
      battery: 64,
      rssi: "-68 dBm",
    },
    "phone-stranger2": {
      x: 440,
      y: 280,
      label: "Stranger #2",
      role: "Relay",
      battery: 78,
      rssi: "-72 dBm",
    },
    "phone-stranger3": {
      x: 440,
      y: 110,
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
  });

  // Calculate dynamic mesh conduits based on proximity
  const meshLinks = [
    { from: "phone-alice", to: "phone-stranger1" },
    { from: "phone-alice", to: "phone-bob" },
    { from: "phone-bob", to: "phone-stranger2" },
    { from: "phone-stranger1", to: "phone-stranger3" },
    { from: "phone-stranger2", to: "phone-stranger3" },
    { from: "phone-stranger3", to: "phone-bridge" },
    { from: "phone-stranger2", to: "phone-bridge" },
  ];

  // Mouse drag handlers
  const handleMouseDown = (deviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingNode(deviceId);
    setSelectedNode(deviceId);
    if (onSelectDevice) onSelectDevice(deviceId);
    sounds.playClick();
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const scaleY = 380 / rect.height;
    const newX = Math.max(50, Math.min(750, (e.clientX - rect.left) * scaleX));
    const newY = Math.max(50, Math.min(340, (e.clientY - rect.top) * scaleY));

    setPositions((prev) => {
      const curr = prev[draggingNode];
      if (!curr) return prev;
      return {
        ...prev,
        [draggingNode]: {
          ...curr,
          x: Math.round(newX),
          y: Math.round(newY),
        },
      };
    });
  }, [draggingNode]);

  const handleMouseUp = useCallback(() => {
    if (draggingNode && onDeviceMove) {
      const pos = positions[draggingNode];
      if (pos) onDeviceMove(draggingNode, pos.x, pos.y);
    }
    setDraggingNode(null);
  }, [draggingNode, onDeviceMove, positions]);

  const selectedDeviceData = devices.find((d) => d.deviceId === selectedNode);
  const selectedPos = selectedNode ? positions[selectedNode] : null;

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_32px_-4px_rgba(15,23,42,0.06)] space-y-5 bg-white/85 dark:bg-slate-900/75 transition-all">
      {/* Top Banner & Control HUD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-indigo-800 shadow-xs">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                Spatial Bluetooth Low Energy (BLE) Mesh Topology
              </h3>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-cyan-300 border border-indigo-200 dark:border-indigo-800/80">
                Interactive Drag & Drop
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Drag nodes across physical zones to observe dynamic signal attenuation (RSSI) and hop propagation
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Move className="w-3.5 h-3.5 text-indigo-500" />
            <span>Interactive Physics</span>
          </span>
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>2.4 GHz BLE Active</span>
          </span>
        </div>
      </div>

      {/* Main Spatial Radar Canvas */}
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner mesh-canvas-bg select-none">
        {/* Environmental Zone Overlays */}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-12 text-[10px] font-mono tracking-wider font-bold">
          <div className="col-span-4 border-r border-dashed border-slate-300/60 dark:border-slate-800/80 p-3 text-slate-400 dark:text-slate-500 flex flex-col justify-between">
            <span className="bg-slate-200/50 dark:bg-slate-900/50 px-2 py-1 rounded w-fit">
              ZONE 1: UNDERGROUND BASEMENT (0% CELLULAR)
            </span>
            <span className="text-[9px] opacity-75">Sender &amp; Receiver Offline</span>
          </div>

          <div className="col-span-5 border-r border-dashed border-slate-300/60 dark:border-slate-800/80 p-3 text-slate-400 dark:text-slate-500 flex flex-col justify-between">
            <span className="bg-slate-200/50 dark:bg-slate-900/50 px-2 py-1 rounded w-fit">
              ZONE 2: STAIRWELL RELAY CONDUIT (BLE GOSSIP)
            </span>
            <span className="text-[9px] opacity-75">Stranger Nodes (Blind Mules)</span>
          </div>

          <div className="col-span-3 p-3 text-emerald-600 dark:text-emerald-400 flex flex-col justify-between bg-emerald-500/5">
            <span className="bg-emerald-100/60 dark:bg-emerald-950/60 px-2 py-1 rounded w-fit border border-emerald-200 dark:border-emerald-800/80">
              ZONE 3: STREET LEVEL (4G BRIDGE)
            </span>
            <span className="text-[9px] opacity-75">Opportunistic Internet Upload</span>
          </div>
        </div>

        {/* Interactive SVG Canvas */}
        <svg
          ref={canvasRef}
          viewBox="0 0 800 380"
          className="w-full h-auto cursor-crosshair relative z-10"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            {/* Wireless Conduit Gradient */}
            <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>

            {/* Signal Wave Radial Glow */}
            <radialGradient id="signalGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Render Active Wireless Conduits */}
          {meshLinks.map((link, idx) => {
            const p1 = positions[link.from];
            const p2 = positions[link.to];
            if (!p1 || !p2) return null;

            const isSelectedLink =
              selectedNode === link.from || selectedNode === link.to;

            return (
              <g key={`link-${idx}`}>
                {/* Background Shadow Conduit */}
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isSelectedLink ? (isDark ? "#38bdf8" : "#4f46e5") : (isDark ? "#334155" : "#cbd5e1")}
                  strokeWidth={isSelectedLink ? "2.5" : "1.5"}
                  strokeOpacity={isSelectedLink ? "0.9" : "0.5"}
                />

                {/* Animated Packet Pulse Stream during Gossip */}
                {isGossiping && (
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="url(#linkGradient)"
                    strokeWidth="3"
                    className="animate-wire-flow"
                  />
                )}
              </g>
            );
          })}

          {/* Render Interactive Nodes */}
          {Object.entries(positions).map(([id, pos]) => {
            const dev = devices.find((d) => d.deviceId === id);
            const isSelected = selectedNode === id;
            const hasPackets = (dev?.packetCount || 0) > 0;
            const isBridge = dev?.hasInternet;

            return (
              <g
                key={id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-grab active:cursor-grabbing transition-transform duration-75"
                onMouseDown={(e) => handleMouseDown(id, e)}
              >
                {/* Signal Pulse Radius */}
                <circle
                  r={isSelected ? "32" : "26"}
                  fill="url(#signalGlow)"
                  className={isSelected ? "animate-pulse" : ""}
                />

                {/* Outer Ring */}
                <circle
                  r={isSelected ? "22" : "18"}
                  fill={isDark ? "#0f172a" : "#ffffff"}
                  stroke={
                    isBridge
                      ? "#10b981"
                      : isSelected
                      ? "#6366f1"
                      : hasPackets
                      ? "#f59e0b"
                      : isDark
                      ? "#334155"
                      : "#cbd5e1"
                  }
                  strokeWidth={isSelected ? "3" : "2"}
                  className="shadow-lg transition-all"
                />

                {/* Inner Role Icon Dot */}
                <circle
                  r="6"
                  fill={
                    isBridge
                      ? "#10b981"
                      : pos.role === "Sender"
                      ? "#6366f1"
                      : pos.role === "Receiver"
                      ? "#0284c7"
                      : "#64748b"
                  }
                />

                {/* Packet Counter Badge */}
                {hasPackets && (
                  <g transform="translate(12, -14)">
                    <circle r="9" fill="#ef4444" className="animate-bounce" />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {dev?.packetCount}
                    </text>
                  </g>
                )}

                {/* Node Label Below */}
                <text
                  textAnchor="middle"
                  y="34"
                  fill={isDark ? "#e2e8f0" : "#1e293b"}
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {pos.label}
                </text>

                {/* Secondary Meta (RSSI) */}
                <text
                  textAnchor="middle"
                  y="47"
                  fill={isDark ? "#94a3b8" : "#64748b"}
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {pos.rssi}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Node Real-Time Telemetry Bar */}
      {selectedNode && selectedPos && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <Smartphone className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                  {selectedPos.label}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Role: {selectedPos.role}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Coordinates: ({selectedPos.x}m, {selectedPos.y}m) • Channel: BLE Advertising CH37
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
            <div className="flex items-center space-x-1.5">
              <Signal className="w-3.5 h-3.5 text-sky-500" />
              <span>RSSI: {selectedPos.rssi}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Battery className="w-3.5 h-3.5 text-emerald-500" />
              <span>Battery: {selectedPos.battery}%</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Buffer: {selectedDeviceData?.packetCount || 0} Packets</span>
            </div>
            <div className="flex items-center space-x-1.5">
              {selectedDeviceData?.hasInternet ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center space-x-1">
                  <UploadCloud className="w-3 h-3" />
                  <span>4G Cellular Active</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">
                  Offline (BLE Store &amp; Forward)
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
