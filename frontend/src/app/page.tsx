"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  Radio,
  Wifi,
  WifiOff,
  Send,
  RefreshCw,
  UploadCloud,
  RotateCcw,
  Layers,
  Lock,
  Key,
  Terminal,
  IndianRupee,
  Smartphone,
  Volume2,
  VolumeX,
  Skull,
  Activity,
  Zap,
  Settings,
  Bot,
} from "lucide-react";
import { sounds } from "@/components/SoundEffects";
import MeshTopologyCanvas from "@/components/MeshTopologyCanvas";
import MobileDeviceMockup from "@/components/MobileDeviceMockup";
import AttackStudio from "@/components/AttackStudio";
import MeshAiChatbot from "@/components/MeshAiChatbot";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  fetchSupabaseAccounts,
  fetchSupabaseTransactions,
} from "@/lib/supabaseClient";

interface Device {
  deviceId: string;
  hasInternet: boolean;
  packetCount: number;
  packetIds: string[];
}

interface Account {
  vpa: string;
  holderName: string;
  balance: number;
  version?: number;
}

interface Transaction {
  id: number;
  senderVpa: string;
  receiverVpa: string;
  amount: number;
  status: string;
  bridgeNodeId: string;
  hopCount: number;
  settledAt: string;
}

interface ServerKeyInfo {
  publicKey?: string;
  algorithm?: string;
  hybridScheme?: string;
}

interface LogEntry {
  id: string;
  time: string;
  type: "info" | "success" | "warning" | "error" | "gossip" | "inject";
  message: string;
}

export default function Home() {
  // Determine smart default API URL
  const [apiUrl, setApiUrl] = useState<string>(() => {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return "http://localhost:8080/api";
    }
    return "https://upi-offline-mesh-rrm4.onrender.com/api";
  });

  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false);
  const [serverKey, setServerKey] = useState<ServerKeyInfo | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"simulation" | "attack">("simulation");
  const [showAiChat, setShowAiChat] = useState<boolean>(false);
  const [supabaseLive, setSupabaseLive] = useState<boolean>(false);

  // Core data states
  const [devices, setDevices] = useState<Device[]>([
    { deviceId: "phone-alice", hasInternet: false, packetCount: 0, packetIds: [] },
    { deviceId: "phone-bob", hasInternet: false, packetCount: 0, packetIds: [] },
    { deviceId: "phone-stranger1", hasInternet: false, packetCount: 0, packetIds: [] },
    { deviceId: "phone-stranger2", hasInternet: false, packetCount: 0, packetIds: [] },
    { deviceId: "phone-stranger3", hasInternet: false, packetCount: 0, packetIds: [] },
    { deviceId: "phone-bridge", hasInternet: true, packetCount: 0, packetIds: [] },
  ]);
  const [idempotencyCacheSize, setIdempotencyCacheSize] = useState<number>(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Mobile / Form states
  const [senderVpa, setSenderVpa] = useState("alice@demo");
  const [receiverVpa, setReceiverVpa] = useState("bob@demo");
  const [amount, setAmount] = useState(500);
  const [pin, setPin] = useState("1234");
  const [ttl, setTtl] = useState(5);
  const [startDevice, setStartDevice] = useState("phone-alice");

  // Loading states
  const [isInjecting, setIsInjecting] = useState(false);
  const [isGossiping, setIsGossiping] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastCiphertextPreview, setLastCiphertextPreview] = useState<string | null>(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      const entry: LogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        time: new Date().toLocaleTimeString(),
        type,
        message,
      };
      setLogs((prev) => [entry, ...prev.slice(0, 99)]);
    },
    []
  );

  // Fetch all backend data (with Supabase direct support and REST fallback)
  const refreshData = useCallback(async () => {
    try {
      // 1. Mesh State
      const meshRes = await fetch(`${apiUrl}/mesh/state`, { cache: "no-store" });
      if (meshRes.ok) {
        const meshData = await meshRes.json();
        if (meshData.devices) setDevices(meshData.devices);
        setIdempotencyCacheSize(meshData.idempotencyCacheSize || 0);
        setBackendOnline(true);
        setIsWakingUp(false);
      } else {
        setBackendOnline(false);
      }

      // 2. Accounts (Try Supabase direct if configured, fallback to backend REST)
      let accountsLoaded = false;
      if (isSupabaseConfigured()) {
        const sbAccounts = await fetchSupabaseAccounts();
        if (sbAccounts && sbAccounts.length > 0) {
          setAccounts(
            sbAccounts.map((a) => ({
              vpa: a.vpa,
              holderName: a.holder_name,
              balance: Number(a.balance),
              version: a.version,
            }))
          );
          accountsLoaded = true;
        }
      }
      if (!accountsLoaded) {
        const accRes = await fetch(`${apiUrl}/accounts`, { cache: "no-store" });
        if (accRes.ok) {
          const accData = await accRes.json();
          setAccounts(accData || []);
        }
      }

      // 3. Transactions (Try Supabase direct if configured, fallback to backend REST)
      let txLoaded = false;
      if (isSupabaseConfigured()) {
        const sbTxs = await fetchSupabaseTransactions();
        if (sbTxs && sbTxs.length > 0) {
          setTransactions(
            sbTxs.map((t) => ({
              id: t.id,
              senderVpa: t.sender_vpa,
              receiverVpa: t.receiver_vpa,
              amount: Number(t.amount),
              status: t.status,
              bridgeNodeId: t.bridge_node_id,
              hopCount: t.hop_count,
              settledAt: t.settled_at,
            }))
          );
          txLoaded = true;
        }
      }
      if (!txLoaded) {
        const txRes = await fetch(`${apiUrl}/transactions`, { cache: "no-store" });
        if (txRes.ok) {
          const txData = await txRes.json();
          setTransactions(txData || []);
        }
      }
    } catch {
      setBackendOnline(false);
      setIsWakingUp(true);
    }
  }, [apiUrl]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    async function loadKey() {
      try {
        const res = await fetch(`${apiUrl}/server-key`);
        if (res.ok) {
          const keyData = await res.json();
          if (isMounted) {
            setServerKey(keyData);
            setBackendOnline(true);
            setIsWakingUp(false);
          }
        }
      } catch {
        if (isMounted) {
          setIsWakingUp(true);
          setBackendOnline(false);
        }
      }
    }

    loadKey();
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl, refreshData]);

  // Supabase Realtime WebSocket subscription
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const sb = getSupabaseClient();
    if (!sb) return;

    const channel = sb
      .channel("upi-mesh-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          sounds.playSettlement();
          addLog("⚡ [SUPABASE REALTIME] New transaction settled in PostgreSQL", "success");
          refreshData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => {
          refreshData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSupabaseLive(true);
          addLog("⚡ [SUPABASE REALTIME] Connected to live PostgreSQL publication channel", "success");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSupabaseLive(false);
        }
      });

    return () => {
      sb.removeChannel(channel);
    };
  }, [addLog, refreshData]);

  // 1. Inject payment into mesh
  const handleInject = async () => {
    if (senderVpa === receiverVpa) {
      sounds.playAlert();
      addLog("Sender and receiver cannot be identical", "warning");
      return;
    }
    setIsInjecting(true);
    try {
      const res = await fetch(`${apiUrl}/demo/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderVpa,
          receiverVpa,
          amount,
          pin,
          ttl,
          startDevice,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastCiphertextPreview(data.ciphertextPreview);
        sounds.playBleChirp();
        addLog(
          `📤 Packet [${data.packetId.substring(0, 8)}] encrypted via RSA-2048 OAEP + AES-256-GCM & injected at ${data.injectedAt} (TTL: ${data.ttl})`,
          "inject"
        );
        refreshData();
      } else {
        sounds.playAlert();
        addLog(`Injection failed (status ${res.status}). If Render was asleep, it is waking up now!`, "error");
      }
    } catch (err: unknown) {
      sounds.playAlert();
      addLog(`Connecting to backend... If Render backend is sleeping, it wakes up in ~30s. (${err instanceof Error ? err.message : String(err)})`, "warning");
    } finally {
      setIsInjecting(false);
    }
  };

  // 2. Gossip step
  const handleGossip = async () => {
    setIsGossiping(true);
    sounds.playBleChirp();
    try {
      const res = await fetch(`${apiUrl}/mesh/gossip`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addLog(
          `🔄 BLE Gossip Round: ${data.transfers} packet transfer(s) across peer devices. State: ${JSON.stringify(data.deviceCounts)}`,
          "gossip"
        );
        refreshData();
      } else {
        sounds.playAlert();
        addLog(`Gossip round failed with status ${res.status}`, "error");
      }
    } catch (err: unknown) {
      sounds.playAlert();
      addLog(`Connecting to backend... (${err instanceof Error ? err.message : String(err)})`, "warning");
    } finally {
      setIsGossiping(false);
    }
  };

  // 3. Flush bridges
  const handleFlush = async () => {
    setIsFlushing(true);
    try {
      const res = await fetch(`${apiUrl}/mesh/flush`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addLog(
          `📡 Bridge Flush: ${data.uploadsAttempted} upload(s) fired concurrently into Spring Boot backend pipeline`,
          "info"
        );

        let settledCount = 0;
        interface BridgeResult {
          bridgeNode: string;
          packetId: string;
          outcome: string;
          reason?: string;
          transactionId?: number;
        }

        data.results.forEach((r: BridgeResult) => {
          if (r.outcome === "SETTLED") {
            settledCount++;
            addLog(
              `✅ SETTLED: Bridge ${r.bridgeNode} delivered packet [${r.packetId}] → Tx ID: ${r.transactionId}`,
              "success"
            );
          } else if (r.outcome === "DUPLICATE_DROPPED") {
            addLog(
              `⚡ DUPLICATE DROPPED: Bridge ${r.bridgeNode} packet [${r.packetId}] dropped by atomic idempotency cache (Zero duplicate debit!)`,
              "warning"
            );
          } else {
            addLog(
              `❌ ${r.outcome}: Bridge ${r.bridgeNode} packet [${r.packetId}] rejected: ${r.reason}`,
              "error"
            );
          }
        });

        if (settledCount > 0) {
          sounds.playSettlement();
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.6 },
          });
        }

        refreshData();
      } else {
        sounds.playAlert();
        addLog(`Flush failed with status ${res.status}`, "error");
      }
    } catch (err: unknown) {
      sounds.playAlert();
      addLog(`Connecting to backend... (${err instanceof Error ? err.message : String(err)})`, "warning");
    } finally {
      setIsFlushing(false);
    }
  };

  // 4. Reset mesh
  const handleReset = async () => {
    setIsResetting(true);
    sounds.playClick();
    try {
      const res = await fetch(`${apiUrl}/mesh/reset`, { method: "POST" });
      if (res.ok) {
        addLog("🗑️ Mesh state and idempotency cache cleared successfully", "info");
        setLastCiphertextPreview(null);
        refreshData();
      }
    } catch (err: unknown) {
      addLog(`Reset signal sent. (${err instanceof Error ? err.message : String(err)})`, "warning");
    } finally {
      setIsResetting(false);
    }
  };

  // Sound toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
    if (next) sounds.playClick();
  };

  // Telemetry aggregates
  const totalVolume = transactions
    .filter((t) => t.status === "SETTLED")
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalPacketsInMesh = devices.reduce(
    (acc, d) => acc + (d.packetCount || 0),
    0
  );

  return (
    <div className="min-h-screen text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 glass-panel sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  UPI Offline Mesh
                </h1>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hidden sm:inline">
                  Decentralized Offline Payments
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">
                Hybrid RSA-OAEP + AES-GCM Gossip Protocol with Atomic Idempotency Settlement
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-lg glass-card text-slate-400 hover:text-white transition cursor-pointer"
              title={soundEnabled ? "Mute Sound Effects" : "Enable Sound Effects"}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Backend connection pill */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border cursor-pointer ${
                backendOnline
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : isWakingUp
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
              onClick={() => refreshData()}
              title="Click to re-ping backend"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  backendOnline
                    ? "bg-emerald-400 animate-pulse"
                    : isWakingUp
                    ? "bg-amber-400 animate-ping"
                    : "bg-slate-500"
                }`}
              />
              <span className="font-medium text-[11px]">
                {backendOnline
                  ? "Core Backend Online"
                  : isWakingUp
                  ? "Waking Render Backend..."
                  : "Connecting..."}
              </span>
            </div>

            {/* Cryptography Inspector Button */}
            <button
              onClick={() => {
                sounds.playClick();
                setShowCryptoModal(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg glass-card text-slate-300 hover:text-white hover:border-indigo-500/40 transition cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline font-medium text-[11px]">Crypto Specs</span>
            </button>

            {/* AI Assistant Quick Toggle */}
            <button
              onClick={() => {
                sounds.playClick();
                setShowAiChat((prev) => !prev);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                showAiChat
                  ? "bg-indigo-600/30 border-indigo-500/60 text-indigo-300 shadow-sm shadow-indigo-500/30"
                  : "glass-card text-slate-300 hover:text-white hover:border-indigo-500/40"
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-medium text-[11px]">AI Enabled</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Waking up Render Banner */}
        {isWakingUp && !backendOnline && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>
                <strong>Render Free Tier Cold Start</strong>: The Spring Boot backend is waking up from sleep mode (~25–35 seconds). You can still click buttons below to send wake-up requests!
              </span>
            </div>
            <button
              onClick={() => refreshData()}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold cursor-pointer"
            >
              Check Now
            </button>
          </div>
        )}

        {/* Live Banking Telemetry HUD */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Total Volume Settled</span>
              <p className="text-xl font-bold font-mono text-emerald-400">
                ₹{totalVolume.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Packets In Mesh</span>
              <p className="text-xl font-bold font-mono text-indigo-400">
                {totalPacketsInMesh}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Idempotency Hashes</span>
              <p className="text-xl font-bold font-mono text-sky-400">
                {idempotencyCacheSize}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center space-x-3.5">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Crypto Integrity</span>
              <p className="text-xl font-bold font-mono text-purple-300">
                100% GCM
              </p>
            </div>
          </div>
        </section>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab("simulation");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition cursor-pointer ${
              activeTab === "simulation"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                : "text-slate-400 hover:text-white glass-card"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Interactive Mesh Simulation</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab("attack");
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition cursor-pointer ${
              activeTab === "attack"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-500/25"
                : "text-slate-400 hover:text-rose-300 glass-card"
            }`}
          >
            <Skull className="w-4 h-4 text-rose-400" />
            <span>Hacker Mode (Security Attack Studio)</span>
          </button>
        </div>

        {activeTab === "simulation" ? (
          <>
            {/* Interactive 2D Mesh Topology Canvas */}
            <MeshTopologyCanvas
              devices={devices}
              isGossiping={isGossiping}
              onSelectDevice={(id) => setStartDevice(id)}
            />

            {/* Split Screen: Sender Mobile Mockup & Mesh Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Realistic Smartphone Simulator */}
              <div className="lg:col-span-5 flex justify-center">
                <MobileDeviceMockup
                  senderVpa={senderVpa}
                  setSenderVpa={setSenderVpa}
                  receiverVpa={receiverVpa}
                  setReceiverVpa={setReceiverVpa}
                  amount={amount}
                  setAmount={setAmount}
                  pin={pin}
                  setPin={setPin}
                  onInject={handleInject}
                  isInjecting={isInjecting}
                  lastCiphertextPreview={lastCiphertextPreview}
                />
              </div>

              {/* Right Column: Step Controls & Cryptography Inspection */}
              <div className="lg:col-span-7 space-y-6">
                {/* Protocol Execution Controls */}
                <div className="glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-slate-100">
                        Protocol Execution Engine
                      </h3>
                      <p className="text-xs text-slate-400">
                        Drive the decentralized gossip rounds and bridge uploads
                      </p>
                    </div>

                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      Step-by-Step Flow
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Gossip Step */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4 text-sky-400" />
                        <span className="font-semibold text-xs text-slate-200">
                          Step 2: BLE Gossip Round
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Each phone broadcasts held packets to nearby Bluetooth peers. Hop TTL decrements.
                      </p>
                      <button
                        onClick={handleGossip}
                        disabled={isGossiping}
                        className="w-full py-2.5 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-medium text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGossiping ? "animate-spin" : ""}`} />
                        <span>Run Gossip Hop</span>
                      </button>
                    </div>

                    {/* Flush Step */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center space-x-2">
                        <UploadCloud className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-xs text-slate-200">
                          Step 3: Bridges Upload (Parallel)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Bridge phone walks outside, hits 4G, and POSTs packets concurrently.
                      </p>
                      <button
                        onClick={handleFlush}
                        disabled={isFlushing}
                        className="w-full py-2.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <UploadCloud className={`w-3.5 h-3.5 ${isFlushing ? "animate-bounce" : ""}`} />
                        <span>Flush Bridges to Core</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Need a fresh slate?</span>
                    <button
                      onClick={handleReset}
                      disabled={isResetting}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center space-x-1 transition cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                      <span>Reset Mesh Buffers & Cache</span>
                    </button>
                  </div>
                </div>

                {/* Live Ciphertext Inspector */}
                {lastCiphertextPreview && (
                  <div className="glass-panel rounded-2xl p-5 border border-indigo-500/30 space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between text-indigo-400">
                      <span className="flex items-center space-x-1.5 font-semibold">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Encrypted Packet Wire Payload</span>
                      </span>
                      <span className="text-[10px] text-slate-500">
                        RSA-OAEP Key Wrap + AES-256-GCM
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900 text-slate-300 text-[11px] break-all leading-relaxed max-h-24 overflow-y-auto">
                      {lastCiphertextPreview}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Hacker Mode / Security Attack Studio */
          <AttackStudio
            apiUrl={apiUrl}
            onLog={addLog}
            onRefresh={refreshData}
          />
        )}

        {/* Live Financial Overview: Account Balances & Transaction Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Account Balances Table */}
          <section className="lg:col-span-4 glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <IndianRupee className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm text-slate-100">Bank Accounts & Balances</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Optimistic Lock @Version</span>
            </div>

            <div className="space-y-2">
              {accounts.map((a) => (
                <div
                  key={a.vpa}
                  className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-semibold text-slate-200">{a.vpa}</span>
                    <p className="text-[11px] text-slate-500">{a.holderName}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-emerald-400">
                      ₹{Number(a.balance).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Settled Transactions Ledger */}
          <section className="lg:col-span-8 glass-panel rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-sm text-slate-100">Settled Transaction Ledger</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {transactions.length} recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-mono text-[11px]">
                    <th className="py-2.5 px-3">Tx ID</th>
                    <th className="py-2.5 px-3">From → To</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Bridge</th>
                    <th className="py-2.5 px-3">Hops</th>
                    <th className="py-2.5 px-3">Settled At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-600 italic">
                        No transactions settled yet. Inject a packet and flush bridge nodes!
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">#{tx.id}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {tx.senderVpa} <span className="text-slate-600">→</span> {tx.receiverVpa}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                          ₹{Number(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === "SETTLED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : tx.status === "DUPLICATE_DROPPED"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{tx.bridgeNodeId}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{tx.hopCount}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {new Date(tx.settledAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Terminal Live Activity Log */}
        <section className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-xs text-slate-200">Real-Time Activity Stream</h3>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition cursor-pointer"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-900 font-mono text-xs max-h-48 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Waiting for events...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start space-x-2 text-[11px] leading-relaxed">
                  <span className="text-slate-600 shrink-0">[{log.time}]</span>
                  <span
                    className={
                      log.type === "success"
                        ? "text-emerald-400 font-medium"
                        : log.type === "warning"
                        ? "text-amber-400"
                        : log.type === "error"
                        ? "text-rose-400 font-semibold"
                        : log.type === "gossip"
                        ? "text-sky-400"
                        : log.type === "inject"
                        ? "text-indigo-400"
                        : "text-slate-400"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </section>
      </main>

      {/* Cryptography Specification Modal */}
      {showCryptoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-base">
                  High-Assurance Cryptography & Idempotency Architecture
                </h3>
              </div>
              <button
                onClick={() => setShowCryptoModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              {/* Backend Endpoint URL Configuration */}
              <div className="p-3 bg-slate-900/90 rounded-xl border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between text-indigo-400 font-semibold">
                  <span className="flex items-center space-x-1.5">
                    <Settings className="w-4 h-4" />
                    <span>Settlement Backend Endpoint</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Live Config</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => {
                      refreshData();
                      sounds.playClick();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer"
                  >
                    Save & Test
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-semibold text-indigo-400 flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>1. Hybrid RSA-OAEP + AES-256-GCM Encryption</span>
                </span>
                <p className="text-slate-400 leading-relaxed">
                  The client generates a one-time AES-256 session key, encrypts the payment payload with authenticated <strong>AES-256-GCM</strong>, and wraps the AES key with the server&apos;s <strong>RSA-2048 (OAEP-SHA256)</strong> public key. Intermediaries cannot read or tamper with the payload. If any bit is altered, the GCM auth tag fails on decryption.
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-semibold text-amber-400 flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>2. The Duplicate-Storm & Atomic Idempotency</span>
                </span>
                <p className="text-slate-400 leading-relaxed">
                  When multiple bridge nodes reach 4G simultaneously with the exact same packet, they all POST to <code>/api/bridge/ingest</code>. The server computes <code>SHA-256(ciphertext)</code> and claims it atomically via <code>putIfAbsent</code> (equivalent to Redis <code>SETNX</code>) <em>before</em> performing expensive RSA decryption. Only the first claimer settles; all others are immediately returned <code>DUPLICATE_DROPPED</code>.
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                  <Key className="w-3.5 h-3.5" />
                  <span>3. Replay Protection</span>
                </span>
                <p className="text-slate-400 leading-relaxed">
                  Every payment instruction includes a unique UUID nonce and a millisecond timestamp. The backend strictly rejects packets older than 24 hours (<code>signedAt</code> window), rendering captured packets unusable for replay.
                </p>
              </div>

              {serverKey && (
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 font-mono text-[11px]">
                  <span className="text-slate-400">Server Public Key Fingerprint:</span>
                  <p className="text-slate-300 break-all mt-1">
                    {serverKey.publicKey?.substring(0, 100)}...
                  </p>
                </div>
              )}
            </div>

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCryptoModal(false)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition cursor-pointer"
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 glass-panel mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>UPI Offline Mesh &copy; {new Date().getFullYear()} — Production Ready Showcase</span>
          <div className="flex items-center space-x-4">
            <span className="text-slate-600">|</span>
            <span>Spring Boot 3.3 Core</span>
            <span>Next.js 16 Frontend</span>
            <span>FastAPI Edge Bridge</span>
          </div>
        </div>
      </footer>

      {/* AI Assistant Chatbot Widget */}
      <MeshAiChatbot
        isOpen={showAiChat}
        onToggle={() => setShowAiChat((prev) => !prev)}
      />
    </div>
  );
}
