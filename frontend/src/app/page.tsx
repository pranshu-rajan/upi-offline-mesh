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
  ArrowRight,
  Server,
  Lock,
  Key,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  IndianRupee,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Zap,
} from "lucide-react";

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
  const [apiUrl, setApiUrl] = useState<string>("/backend-api");
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [serverKey, setServerKey] = useState<ServerKeyInfo | null>(null);

  // Core data states
  const [devices, setDevices] = useState<Device[]>([]);
  const [idempotencyCacheSize, setIdempotencyCacheSize] = useState<number>(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Form states
  const [senderVpa, setSenderVpa] = useState("alice@demo");
  const [receiverVpa, setReceiverVpa] = useState("bob@demo");
  const [amount, setAmount] = useState(500);
  const [pin, setPin] = useState("1234");
  const [ttl, setTtl] = useState(5);
  const [startDevice, setStartDevice] = useState("phone-alice");

  // UI state
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

  // Fetch all backend data
  const refreshData = useCallback(async () => {
    try {
      // 1. Mesh State
      const meshRes = await fetch(`${apiUrl}/mesh/state`, { cache: "no-store" });
      if (meshRes.ok) {
        const meshData = await meshRes.json();
        setDevices(meshData.devices || []);
        setIdempotencyCacheSize(meshData.idempotencyCacheSize || 0);
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }

      // 2. Accounts
      const accRes = await fetch(`${apiUrl}/accounts`, { cache: "no-store" });
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccounts(accData || []);
      }

      // 3. Transactions
      const txRes = await fetch(`${apiUrl}/transactions`, { cache: "no-store" });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData || []);
      }
    } catch {
      setBackendOnline(false);
    }
  }, [apiUrl]);

  // Initial load: Key + Data + Poll
  useEffect(() => {
    async function loadKey() {
      try {
        const res = await fetch(`${apiUrl}/server-key`);
        if (res.ok) {
          const keyData = await res.json();
          setServerKey(keyData);
          setBackendOnline(true);
        }
      } catch {
        // Fallback: try direct localhost if proxy failed
        if (apiUrl === "/backend-api") {
          try {
            const direct = await fetch("http://localhost:8080/api/server-key");
            if (direct.ok) {
              setApiUrl("http://localhost:8080/api");
              const k = await direct.json();
              setServerKey(k);
              setBackendOnline(true);
            }
          } catch {
            setBackendOnline(false);
          }
        }
      }
    }

    loadKey();
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [apiUrl, refreshData]);

  // 1. Inject payment
  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senderVpa === receiverVpa) {
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
        addLog(
          `📤 Packet [${data.packetId.substring(0, 8)}] created! Encrypted with Server RSA-OAEP + AES-GCM and injected at ${data.injectedAt} (TTL: ${data.ttl})`,
          "inject"
        );
        refreshData();
      } else {
        addLog(`Injection failed with status ${res.status}`, "error");
      }
    } catch (err: unknown) {
      addLog(`Error injecting packet: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsInjecting(false);
    }
  };

  // 2. Gossip step
  const handleGossip = async () => {
    setIsGossiping(true);
    try {
      const res = await fetch(`${apiUrl}/mesh/gossip`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addLog(
          `🔄 Gossip Round complete: ${data.transfers} packet transfer(s) across Bluetooth mesh. Distribution: ${JSON.stringify(data.deviceCounts)}`,
          "gossip"
        );
        refreshData();
      } else {
        addLog(`Gossip round failed with status ${res.status}`, "error");
      }
    } catch (err: unknown) {
      addLog(`Error running gossip: ${err instanceof Error ? err.message : String(err)}`, "error");
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
        let dupCount = 0;

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
            dupCount++;
            addLog(
              `⚡ DUPLICATE DROPPED: Bridge ${r.bridgeNode} packet [${r.packetId}] rejected by atomic idempotency cache (Zero duplicate settlement!)`,
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
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
          });
        }

        refreshData();
      } else {
        addLog(`Flush failed with status ${res.status}`, "error");
      }
    } catch (err: unknown) {
      addLog(`Error flushing bridges: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsFlushing(false);
    }
  };

  // 4. Reset mesh
  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch(`${apiUrl}/mesh/reset`, { method: "POST" });
      if (res.ok) {
        addLog("🗑️ Mesh state and idempotency cache cleared successfully", "info");
        setLastCiphertextPreview(null);
        refreshData();
      }
    } catch (err: unknown) {
      addLog(`Error resetting mesh: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
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
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Zero-Internet Payment Mesh
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Hybrid RSA-OAEP + AES-GCM Encrypted Gossip with Atomic Idempotency Settlement
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {/* Backend connection pill */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border ${
                backendOnline
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className="font-medium">
                {backendOnline ? "Core Backend Online" : "Backend Disconnected"}
              </span>
            </div>

            {/* Cryptography Inspector Button */}
            <button
              onClick={() => setShowCryptoModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg glass-card text-slate-300 hover:text-white hover:border-indigo-500/40 transition"
            >
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline font-medium">Crypto Specs</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Architecture Pipeline Stepper */}
        <section className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Zap className="w-5 h-5" />
              </span>
              <div>
                <h2 className="font-semibold text-sm text-slate-200">
                  Decentralized Mesh-Routed Payment Pipeline
                </h2>
                <p className="text-xs text-slate-400">
                  How a payment moves from a disconnected phone in a basement to settled bank credit:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center space-x-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                  1
                </span>
                <span className="text-slate-300">Offline Encrypt</span>
              </div>
              <div className="flex items-center space-x-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                  2
                </span>
                <span className="text-slate-300">BLE Gossip Hops</span>
              </div>
              <div className="flex items-center space-x-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                  3
                </span>
                <span className="text-slate-300">Bridge 4G Upload</span>
              </div>
              <div className="flex items-center space-x-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                  4
                </span>
                <span className="text-slate-300">Atomic Settle</span>
              </div>
            </div>
          </div>
        </section>

        {/* Mesh Device Topology Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-slate-200">Virtual Bluetooth Mesh Devices</h2>
              <span className="text-xs text-slate-500 font-mono">({devices.length} Nodes in Field)</span>
            </div>
            <div className="text-xs text-slate-400 flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span>Offline Relay</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>4G Internet Bridge</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {devices.map((d) => {
              const isBridge = d.hasInternet;
              const hasPackets = d.packetCount > 0;
              return (
                <div
                  key={d.deviceId}
                  className={`glass-card rounded-xl p-4 transition-all duration-300 relative group overflow-hidden border ${
                    isBridge
                      ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/60"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm tracking-tight text-white flex items-center space-x-1.5">
                        <span>{d.deviceId}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isBridge ? "Bridge Gateway" : "Offline Phone"}
                      </p>
                    </div>

                    <div
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 ${
                        isBridge
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                      title={isBridge ? "Connected to Cellular 4G" : "No Internet Connection"}
                    >
                      {isBridge ? (
                        <>
                          <Wifi className="w-3.5 h-3.5" />
                          <span className="text-[10px]">4G</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3.5 h-3.5" />
                          <span className="text-[10px]">OFFLINE</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Packet Buffer Section */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-400">Packet Buffer:</span>
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          hasPackets
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse"
                            : "bg-slate-800/50 text-slate-500"
                        }`}
                      >
                        {d.packetCount} {d.packetCount === 1 ? "packet" : "packets"}
                      </span>
                    </div>

                    {d.packetIds && d.packetIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {d.packetIds.map((pid, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded text-indigo-300 border border-indigo-500/20"
                          >
                            #{pid}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-600 italic">No packets held</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Interactive Simulation Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Step 1: Payment Composer */}
          <section className="lg:col-span-5 glass-panel rounded-2xl p-6 border border-slate-800 space-y-5">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow">
                1
              </span>
              <div>
                <h3 className="font-semibold text-sm text-slate-100">Step 1: Compose Offline Payment</h3>
                <p className="text-xs text-slate-400">
                  Simulate sender phone encrypting with Server RSA public key
                </p>
              </div>
            </div>

            <form onSubmit={handleInject} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Sender VPA</label>
                  <select
                    value={senderVpa}
                    onChange={(e) => setSenderVpa(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="alice@demo">alice@demo (Alice)</option>
                    <option value="bob@demo">bob@demo (Bob)</option>
                    <option value="carol@demo">carol@demo (Carol)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Receiver VPA</label>
                  <select
                    value={receiverVpa}
                    onChange={(e) => setReceiverVpa(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="bob@demo">bob@demo (Bob)</option>
                    <option value="carol@demo">carol@demo (Carol)</option>
                    <option value="alice@demo">alice@demo (Alice)</option>
                    <option value="dave@demo">dave@demo (Dave)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">UPI PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono tracking-widest focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Mesh TTL</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={ttl}
                    onChange={(e) => setTtl(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Inject At Virtual Phone</label>
                <select
                  value={startDevice}
                  onChange={(e) => setStartDevice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.deviceId} {d.hasInternet ? "(Bridge)" : "(Offline)"}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isInjecting || !backendOnline}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer"
              >
                {isInjecting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Encrypt & Inject Packet into Mesh</span>
              </button>
            </form>

            {lastCiphertextPreview && (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-indigo-500/20 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between text-indigo-400 text-[11px] font-sans font-semibold">
                  <span className="flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>RSA-OAEP + AES-GCM Ciphertext</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Encrypted Payload</span>
                </div>
                <p className="text-slate-400 text-[10px] break-all leading-tight">
                  {lastCiphertextPreview}
                </p>
              </div>
            )}
          </section>

          {/* Steps 2 & 3: Mesh Actions */}
          <section className="lg:col-span-7 glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shadow">
                    2 & 3
                  </span>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100">
                      Gossip & Bridge Ingestion Controls
                    </h3>
                    <p className="text-xs text-slate-400">
                      Propagate packets device-to-device and trigger duplicate-storm ingestion
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Idempotency Cache:</span>{" "}
                  <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {idempotencyCacheSize} hashes
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Gossip Card */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-xs text-slate-200">Step 2: BLE Mesh Gossip</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Phones broadcast held packets to nearby peers. TTL decrements per hop.
                  </p>
                  <button
                    onClick={handleGossip}
                    disabled={isGossiping || !backendOnline}
                    className="w-full py-2 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-medium text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGossiping ? "animate-spin" : ""}`} />
                    <span>Run 1 Gossip Round</span>
                  </button>
                </div>

                {/* Flush Bridges Card */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2">
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-xs text-slate-200">
                      Step 3: Bridges Upload (Parallel)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Bridge phone gets 4G signal and POSTs packets concurrently. Exercises idempotency!
                  </p>
                  <button
                    onClick={handleFlush}
                    disabled={isFlushing || !backendOnline}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isFlushing ? "animate-bounce" : ""}`} />
                    <span>Flush Bridges to Backend</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Reset Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Want to test duplicate storm or fresh state?
              </span>
              <button
                onClick={handleReset}
                disabled={isResetting || !backendOnline}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center space-x-1 transition cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                <span>Reset Mesh + Cache</span>
              </button>
            </div>
          </section>
        </div>

        {/* Financial Overview: Account Balances & Transaction Ledger */}
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
              className="text-[11px] text-slate-500 hover:text-slate-300 transition"
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
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-semibold text-indigo-400 flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>1. Hybrid RSA-OAEP + AES-256-GCM Encryption</span>
                </span>
                <p className="text-slate-400 leading-relaxed">
                  The client generates a one-time AES-256 session key, encrypts the payment payload with authenticated <strong>AES-256-GCM</strong>, and wraps the AES key with the server's <strong>RSA-2048 (OAEP-SHA256)</strong> public key. Intermediaries cannot read or tamper with the payload. If any bit is altered, the GCM auth tag fails on decryption.
                </p>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1.5">
                <span className="font-semibold text-amber-400 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
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
            <span>Next.js 14 Frontend</span>
            <span>FastAPI Edge Bridge</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
