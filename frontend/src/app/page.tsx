"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  Radio,
  RefreshCw,
  UploadCloud,
  RotateCcw,
  Layers,
  Lock,
  Key,
  Terminal,
  IndianRupee,
  Volume2,
  VolumeX,
  Skull,
  Activity,
  Zap,
  Bot,
  Copy,
  Check,
  Sun,
  Moon,
  Move,
  Binary,
} from "lucide-react";
import { sounds } from "@/components/SoundEffects";
import MeshTopologyCanvas from "@/components/MeshTopologyCanvas";
import MobileDeviceMockup from "@/components/MobileDeviceMockup";
import AttackStudio from "@/components/AttackStudio";
import MeshAiChatbot from "@/components/MeshAiChatbot";
import PacketByteDissector from "@/components/PacketByteDissector";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  fetchSupabaseAccounts,
  fetchSupabaseTransactions,
} from "@/lib/supabaseClient";
import { Device, Account, Transaction, ServerKeyInfo, LogEntry } from "@/types/mesh";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

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
  const [, setSupabaseLive] = useState<boolean>(false);

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
  const [ttl] = useState(5);
  const [startDevice, setStartDevice] = useState("phone-alice");

  // Loading states
  const [isInjecting, setIsInjecting] = useState(false);
  const [isGossiping, setIsGossiping] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [lastCiphertextPreview, setLastCiphertextPreview] = useState<string | null>(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load saved theme on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = localStorage.getItem("upi_mesh_theme") as "light" | "dark" | null;
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        document.documentElement.classList.toggle("dark", saved === "dark");
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", "light");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("upi_mesh_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.setAttribute("data-theme", next);
    sounds.playClick();
  };

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
              devicePublicKey: a.device_public_key,
              lastSequenceNumber: a.last_sequence_number,
              offlineLimit: a.offline_limit ? Number(a.offline_limit) : 5000,
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

    const timer = setTimeout(() => {
      loadKey();
      refreshData();
    }, 0);
    const interval = setInterval(refreshData, 3000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
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
        () => {
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
          `📤 Packet [${data.packetId.substring(0, 8)}] signed via ECDSA P-256, encrypted via RSA-OAEP + AES-GCM & injected at ${data.injectedAt} (TTL: ${data.ttl})`,
          "inject"
        );
        refreshData();
      } else {
        sounds.playAlert();
        addLog(`Injection failed (status ${res.status}). If backend was asleep, it is waking up!`, "error");
      }
    } catch (err: unknown) {
      sounds.playAlert();
      addLog(`Connecting to backend... (${err instanceof Error ? err.message : String(err)})`, "warning");
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
          `📡 Bridge Flush: ${data.uploadsAttempted} upload(s) fired concurrently into settlement core`,
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
              `⚡ DUPLICATE DROPPED: Bridge ${r.bridgeNode} packet [${r.packetId}] caught by atomic idempotency gate (Zero duplicate debit!)`,
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
            particleCount: 90,
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
    <div className="min-h-screen text-slate-900 dark:text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-slate-200/90 dark:border-slate-800/80 glass-panel sticky top-0 z-40 bg-white/85 dark:bg-slate-950/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-emerald-500 p-0.5 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[14px] flex items-center justify-center transition-colors">
                <Radio className="w-5 h-5 text-indigo-600 dark:text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                  UPI Offline Mesh
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 hidden sm:inline shadow-xs">
                  Decentralized Store-and-Forward
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">
                ECDSA P-256 Signatures • RSA-2048 OAEP + AES-256 GCM • Monotonic Anti-Fork Settlement
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              type="button"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className={`theme-toggle-btn flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-xs ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800 hover:border-slate-600"
                  : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 hover:border-slate-400"
              }`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
              <span className="hidden sm:inline font-mono">{theme === "dark" ? "Light" : "Dark"}</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="p-2 rounded-xl glass-card text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer"
              title={soundEnabled ? "Mute Sound Effects" : "Enable Sound Effects"}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Backend connection status pill */}
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border cursor-pointer transition shadow-xs ${
                backendOnline
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300"
                  : isWakingUp
                  ? "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 animate-pulse"
                  : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
              }`}
              onClick={() => refreshData()}
              title="Click to re-ping settlement engine"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  backendOnline
                    ? "bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900 animate-pulse"
                    : isWakingUp
                    ? "bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900 animate-ping"
                    : "bg-slate-400"
                }`}
              />
              <span className="font-bold text-[11px]">
                {backendOnline
                  ? "Settlement Core Online"
                  : isWakingUp
                  ? "Waking Backend..."
                  : "Connecting..."}
              </span>
            </div>

            {/* Cryptography Specification Modal Trigger */}
            <button
              onClick={() => {
                sounds.playClick();
                setShowCryptoModal(true);
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-card text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-cyan-400 hover:border-indigo-300 dark:hover:border-cyan-500/40 transition cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400" />
              <span className="hidden sm:inline font-bold text-[11px]">Crypto Specs</span>
            </button>

            {/* AI Assistant Quick Toggle */}
            <button
              onClick={() => {
                sounds.playClick();
                setShowAiChat((prev) => !prev);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition cursor-pointer shadow-xs ${
                showAiChat
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/25"
                  : "glass-card text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-cyan-400 hover:border-indigo-300 dark:hover:border-slate-700"
              }`}
            >
              <Bot className={`w-3.5 h-3.5 ${showAiChat ? "text-white" : "text-indigo-600 dark:text-cyan-400"}`} />
              <span className="font-bold text-[11px]">AI Copilot</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Render Free Tier Cold Start Banner */}
        {isWakingUp && !backendOnline && (
          <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-2xl text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Render Free Tier Cold Start</strong>: The Spring Boot settlement backend is spinning up (~25–35s). You can still trigger payments or gossip rounds below!
              </span>
            </div>
            <button
              onClick={() => refreshData()}
              className="px-3 py-1 rounded-xl bg-amber-200/60 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 font-bold cursor-pointer transition shadow-xs shrink-0"
            >
              Check Now
            </button>
          </div>
        )}

        {/* Live Banking Telemetry Bento HUD (4 Metric Cards) */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 flex items-center space-x-4 shadow-sm bg-white/90 dark:bg-slate-900/80">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                Total Volume Settled
              </span>
              <p className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                ₹{totalVolume.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 flex items-center space-x-4 shadow-sm bg-white/90 dark:bg-slate-900/80">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                Packets In Mesh
              </span>
              <p className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-600 dark:text-cyan-400 tracking-tight">
                {totalPacketsInMesh}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 flex items-center space-x-4 shadow-sm bg-white/90 dark:bg-slate-900/80">
            <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-800/80 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                Dual-Tier Idempotency
              </span>
              <p className="text-xl sm:text-2xl font-extrabold font-mono text-sky-600 dark:text-sky-400 tracking-tight">
                {idempotencyCacheSize} Hashes
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 flex items-center space-x-4 shadow-sm bg-white/90 dark:bg-slate-900/80">
            <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/80 shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                Crypto Integrity
              </span>
              <p className="text-xl sm:text-2xl font-extrabold font-mono text-purple-700 dark:text-purple-300 tracking-tight">
                ECDSA + GCM
              </p>
            </div>
          </div>
        </section>

        {/* Mode Switcher Segmented Control */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="bg-slate-200/70 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-300/70 dark:border-slate-800 inline-flex space-x-1 shadow-inner">
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab("simulation");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
                activeTab === "simulation"
                  ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-cyan-400 shadow-md shadow-slate-300/50 dark:shadow-black/50"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Activity className={`w-4 h-4 ${activeTab === "simulation" ? "text-indigo-600 dark:text-cyan-400" : "text-slate-500"}`} />
              <span>Interactive Mesh Simulation</span>
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab("attack");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer ${
                activeTab === "attack"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-500/25"
                  : "text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-300"
              }`}
            >
              <Skull className={`w-4 h-4 ${activeTab === "attack" ? "text-white" : "text-rose-600 dark:text-rose-400"}`} />
              <span>Hacker Mode (Security Attack Studio 2.0)</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-medium font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Supabase Realtime WebSockets</span>
          </div>
        </div>

        {activeTab === "simulation" ? (
          <>
            {/* Interactive 2D Spatial Mesh Topology Canvas */}
            <MeshTopologyCanvas
              devices={devices}
              isGossiping={isGossiping}
              onSelectDevice={(id) => setStartDevice(id)}
              theme={theme}
            />

            {/* Split Screen: Smartphone Simulator & Mesh Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Photorealistic Smartphone Client Simulator */}
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
                  theme={theme}
                />
              </div>

              {/* Right Column: Protocol Execution Stepper & Byte Dissector */}
              <div className="lg:col-span-7 space-y-6">
                {/* Protocol Execution Controls */}
                <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-5 bg-white/85 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                        Protocol Execution Engine
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Step through the store-and-forward gossip hops and concurrent bridge settlement uploads
                      </p>
                    </div>

                    <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-cyan-400 bg-indigo-50 dark:bg-cyan-950/80 border border-indigo-200 dark:border-cyan-800 px-3 py-1 rounded-full shadow-xs">
                      Step-by-Step Flow
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Gossip Step */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between shadow-xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            Step 2: BLE Gossip Round
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Each phone broadcasts held packets to neighboring Bluetooth peers. Hop TTL decrements.
                        </p>
                      </div>
                      <button
                        onClick={handleGossip}
                        disabled={isGossiping}
                        className="w-full py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGossiping ? "animate-spin" : ""}`} />
                        <span>Run Gossip Hop</span>
                      </button>
                    </div>

                    {/* Flush Step */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between shadow-xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            Step 3: Bridges Upload (Parallel)
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Bridge phone walks outside, acquires 4G, and POSTs packets concurrently to settlement core.
                        </p>
                      </div>
                      <button
                        onClick={handleFlush}
                        disabled={isFlushing}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        <UploadCloud className={`w-3.5 h-3.5 ${isFlushing ? "animate-bounce" : ""}`} />
                        <span>Flush Bridges to Core</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Need to restart the demo?</span>
                    <button
                      onClick={handleReset}
                      disabled={isResetting}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                      <span>Reset Mesh Buffers &amp; Cache</span>
                    </button>
                  </div>
                </div>

                {/* Wireshark-Grade Cryptographic Wire Inspector & Byte Dissector */}
                <PacketByteDissector
                  ciphertextPreview={lastCiphertextPreview}
                  theme={theme}
                  onTamperSimulate={() => {
                    addLog("🚨 [TAMPER SIMULATOR] Corrupted Byte 128 in ciphertext! Watch next flush fail GCM authentication tag verification.", "warning");
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          /* Hacker Mode / Security Attack Studio 2.0 */
          <AttackStudio
            apiUrl={apiUrl}
            onLog={addLog}
            onRefresh={refreshData}
            theme={theme}
          />
        )}

        {/* Live Financial Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Account Balances Table */}
          <section className="lg:col-span-4 glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-4 bg-white/85 dark:bg-slate-900/70">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Bank Accounts &amp; Balances</h3>
              </div>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 font-mono font-bold">
                Optimistic Lock @Version
              </span>
            </div>

            <div className="space-y-2.5">
              {accounts.map((a) => (
                <div
                  key={a.vpa}
                  className="p-3.5 bg-slate-50/90 dark:bg-slate-950/60 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between transition shadow-xs"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{a.vpa}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {a.holderName} • Seq: #{a.lastSequenceNumber || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      ₹{Number(a.balance).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Settled Transactions Ledger */}
          <section className="lg:col-span-8 glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-4 bg-white/85 dark:bg-slate-900/70">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-indigo-800">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Settled Transaction Ledger</h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
                {transactions.length} recorded
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <table className="w-full text-left text-xs border-collapse bg-white dark:bg-slate-950/80">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    <th className="py-3 px-3.5 font-bold">Tx ID</th>
                    <th className="py-3 px-3.5 font-bold">From → To</th>
                    <th className="py-3 px-3.5 font-bold">Amount</th>
                    <th className="py-3 px-3.5 font-bold">Status</th>
                    <th className="py-3 px-3.5 font-bold">Bridge</th>
                    <th className="py-3 px-3.5 font-bold">Hops</th>
                    <th className="py-3 px-3.5 font-bold">Settled At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-600 italic">
                        No transactions settled yet. Authorize an offline payment and flush bridge nodes!
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition">
                        <td className="py-3 px-3.5 font-mono text-slate-500 dark:text-slate-400 font-semibold">#{tx.id}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-800 dark:text-slate-200 font-medium">
                          {tx.senderVpa} <span className="text-slate-400">→</span> {tx.receiverVpa}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              tx.status === "SETTLED"
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                : tx.status === "DUPLICATE_DROPPED"
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-400">{tx.bridgeNodeId}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-400 font-semibold">{tx.hopCount}</td>
                        <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">
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

        {/* Real-Time Terminal Activity Stream */}
        <section className="glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] space-y-3.5 bg-white/85 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Real-Time Event Stream</h3>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition cursor-pointer"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-900 font-mono text-xs max-h-52 overflow-y-auto space-y-1.5 shadow-inner">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Waiting for events...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start space-x-2.5 text-[11px] leading-relaxed">
                  <span className="text-slate-500 shrink-0 font-medium">[{log.time}]</span>
                  <span
                    className={
                      log.type === "success"
                        ? "text-emerald-400 font-semibold"
                        : log.type === "warning"
                        ? "text-amber-400 font-medium"
                        : log.type === "error"
                        ? "text-rose-400 font-bold"
                        : log.type === "gossip"
                        ? "text-sky-300 font-medium"
                        : log.type === "inject"
                        ? "text-indigo-400 font-semibold"
                        : "text-slate-300"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-indigo-800">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Cryptographic Protocol Specifications
                </h3>
              </div>
              <button
                onClick={() => setShowCryptoModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block font-mono">
                  1. ECDSA P-256 Hardware Non-Repudiation
                </span>
                <p className="leading-relaxed">
                  Each mobile client holds an elliptic curve private key (secp256r1) in hardware. The instruction is signed with SHA256withECDSA over a canonical string including the monotonic sequence counter.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block font-mono">
                  2. Hybrid RSA-2048 OAEP + AES-256-GCM
                </span>
                <p className="leading-relaxed">
                  An ephemeral 256-bit AES key is generated per transaction, wrapped with RSA-2048 OAEP-SHA256, and verified with an authenticated 128-bit Galois authentication tag.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block font-mono">
                  3. Dual-Tier Idempotency Gate
                </span>
                <p className="leading-relaxed">
                  Fast sub-microsecond atomic in-memory cache backed by a durable PostgreSQL table deduplicates against duplicate storms.
                </p>
              </div>

              {serverKey && (
                <div className="space-y-1 pt-2">
                  <span className="font-bold text-slate-900 dark:text-white block font-mono">
                    Server Public Key Fingerprint
                  </span>
                  <div className="p-2.5 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[10px] break-all border border-slate-800 shadow-inner">
                    {serverKey.publicKey?.substring(0, 160)}...
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowCryptoModal(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-indigo-500/25 transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Copilot Drawer */}
      <MeshAiChatbot
        isOpen={showAiChat}
        onToggle={() => setShowAiChat((prev) => !prev)}
        theme={theme}
      />
    </div>
  );
}
