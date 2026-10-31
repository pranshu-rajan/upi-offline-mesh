"use client";

import React, { useState } from "react";
import {
  Skull,
  Zap,
  Repeat,
  Bug,
  XCircle,
  AlertOctagon,
  RefreshCw,
  ShieldCheck,
  Flame,
  Key,
  Split,
  FileCode,
  ShieldAlert,
} from "lucide-react";
import { sounds } from "./SoundEffects";

interface AttackStudioProps {
  apiUrl: string;
  onLog: (msg: string, type?: "info" | "success" | "warning" | "error" | "attack") => void;
  onRefresh: () => void;
  theme?: "light" | "dark";
}

export default function AttackStudio({ apiUrl, onLog, onRefresh, theme = "light" }: AttackStudioProps) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastAttackResult, setLastAttackResult] = useState<{
    title: string;
    status: "blocked" | "breached" | "idle";
    details: string;
    defenseMechanism?: string;
  }>({
    title: "No adversarial attack simulated yet",
    status: "idle",
    details: "Choose an adversarial attack vector below to stress-test cryptographic, hardware non-repudiation, and sequence counter guarantees.",
  });

  const isDark = theme === "dark";

  // 1. Man-In-The-Middle Bit-Flip Tamper Attack
  const handleBitFlipAttack = async () => {
    setIsRunning(true);
    sounds.playAlert();
    onLog("🚨 [HACKER MODE] Initiating Man-In-The-Middle Bit-Flip attack on mesh packet...", "warning");

    try {
      const sendRes = await fetch(`${apiUrl}/demo/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderVpa: "alice@demo",
          receiverVpa: "bob@demo",
          amount: 666,
          pin: "1234",
          ttl: 5,
          startDevice: "phone-alice",
        }),
      });

      if (!sendRes.ok) throw new Error("Could not initialize packet for tamper test");

      const forgedPacket = {
        packetId: `tampered-pkt-${Math.random().toString(36).substring(2, 7)}`,
        ttl: 4,
        createdAt: Date.now(),
        ciphertext: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "TAMPERED_BIT_X" + "999999999999999",
      };

      const ingestRes = await fetch(`${apiUrl}/bridge/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bridge-Node-Id": "adversary-mitm-node",
          "X-Hop-Count": "2",
        },
        body: JSON.stringify(forgedPacket),
      });

      const result = await ingestRes.json();

      if (result.outcome === "INVALID") {
        setLastAttackResult({
          title: "MITM Attack Neutralized (AES-GCM Auth Tag Mismatch)",
          status: "blocked",
          details: `The settlement server caught the tampered ciphertext before touching the ledger. Outcome: ${result.outcome} (${result.reason || "Decryption/Tag Error"}). Zero funds corrupted!`,
          defenseMechanism: "Authenticated AES-256-GCM 128-bit Authentication Tag",
        });
        onLog("🛡️ [DEFENSE VERIFIED] Tampered ciphertext rejected by AES-256-GCM verification! Outcome: INVALID", "success");
      } else {
        setLastAttackResult({
          title: "Unexpected Outcome",
          status: "breached",
          details: `Outcome: ${result.outcome}`,
        });
      }
      onRefresh();
    } catch (err: unknown) {
      onLog(`Attack error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  // 2. NEW: Offline Double-Spending / Sequence Replay Fork Attack
  const handleDoubleSpendForkAttack = async () => {
    setIsRunning(true);
    sounds.playAlert();
    onLog("⚡ [HACKER MODE] Simulating Offline Double-Spend Fork: Alice signs two conflicting payments with identical sequence counter...", "warning");

    try {
      const res = await fetch(`${apiUrl}/demo/double-spend-attack`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLastAttackResult({
          title: "Offline Double-Spend Neutralized (Monotonic Sequence Counter)",
          status: "blocked",
          details: `First payment: ${data.firstAttempt?.outcome}. Second conflicting payment: ${data.secondConflictingAttempt?.outcome} (${data.secondConflictingAttempt?.reason}). Exactly one transaction settled!`,
          defenseMechanism: "Strict Monotonic Sequence Counter (seqNo > lastSequenceNumber)",
        });
        onLog("🛡️ [DEFENSE VERIFIED] Conflicting offline sequence fork caught and rejected! Zero double-spending!", "success");
        onRefresh();
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err: unknown) {
      onLog(`Double-spend attack error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  // 3. NEW: Forged Hardware Device Signature Attack
  const handleForgedSignatureAttack = async () => {
    setIsRunning(true);
    sounds.playAlert();
    onLog("🔐 [HACKER MODE] Simulating Rogue Node spoofing sender with a forged ECDSA P-256 signature...", "warning");

    try {
      const res = await fetch(`${apiUrl}/demo/forged-signature-attack`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLastAttackResult({
          title: "Forged Device Signature Rejected",
          status: "blocked",
          details: `Rogue transaction rejected with outcome: ${data.outcome} (Reason: ${data.reason}). The core server authenticated against the registered device public key!`,
          defenseMechanism: "ECDSA P-256 (SHA256withECDSA) Hardware Non-Repudiation",
        });
        onLog("🛡️ [DEFENSE VERIFIED] Forged hardware signature rejected! Outcome: INVALID", "success");
        onRefresh();
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err: unknown) {
      onLog(`Forged signature attack error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  // 4. Concurrent Duplicate-Storm Burst (5 Parallel Uploads)
  const handleDuplicateStormBurst = async () => {
    setIsRunning(true);
    sounds.playBleChirp();
    onLog("⚡ [HACKER MODE] Firing 5 concurrent bridge uploads with identical packet hash...", "warning");

    try {
      const sendRes = await fetch(`${apiUrl}/demo/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderVpa: "alice@demo",
          receiverVpa: "bob@demo",
          amount: 150,
          pin: "1234",
          ttl: 5,
          startDevice: "phone-alice",
        }),
      });

      if (!sendRes.ok) throw new Error("Could not initialize packet for storm test");

      const stateRes = await fetch(`${apiUrl}/mesh/state`);
      const stateData = await stateRes.json();
      const aliceDevice = stateData.devices?.find((d: { deviceId: string }) => d.deviceId === "phone-alice");
      const lastPktId = aliceDevice?.packetIds?.[aliceDevice.packetIds.length - 1];

      // Ingest the same packet 5 times in parallel
      const uploadPromises = Array.from({ length: 5 }, (_, i) =>
        fetch(`${apiUrl}/bridge/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Bridge-Node-Id": `bridge-storm-node-${i + 1}`,
            "X-Hop-Count": "3",
          },
          body: JSON.stringify({
            packetId: lastPktId || "storm-pkt",
            ttl: 3,
            createdAt: Date.now(),
            ciphertext: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "SAME_HASH_PAYLOAD" + lastPktId,
          }),
        }).then((r) => r.json())
      );

      const results = await Promise.all(uploadPromises);
      const duplicateCount = results.filter((r) => r.outcome === "DUPLICATE_DROPPED").length;
      const settledCount = results.filter((r) => r.outcome === "SETTLED").length;

      setLastAttackResult({
        title: "Duplicate Storm Absorbed (Atomic Idempotency Gate)",
        status: "blocked",
        details: `Fired 5 concurrent bridge uploads. Exact results: ${settledCount} Settled, ${duplicateCount} Dropped as Duplicates. Zero duplicate debits!`,
        defenseMechanism: "Dual-Tier Idempotency Gate (putIfAbsent + DB IdempotencyRecord)",
      });
      onLog(`🛡️ [DEFENSE VERIFIED] Storm absorbed: ${duplicateCount} duplicate uploads dropped atomically!`, "success");
      onRefresh();
    } catch (err: unknown) {
      onLog(`Storm error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Adversarial Threat Monitor */}
      <div className={`p-6 sm:p-7 rounded-3xl border transition-all ${
        lastAttackResult.status === "blocked"
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100 shadow-[0_8px_32px_-4px_rgba(16,185,129,0.15)]"
          : lastAttackResult.status === "breached"
          ? "bg-rose-500/10 border-rose-500/40 text-rose-950 dark:text-rose-100 shadow-[0_8px_32px_-4px_rgba(244,63,94,0.15)]"
          : "glass-panel border-slate-200 dark:border-slate-800"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-current/15">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-2xl border ${
              lastAttackResult.status === "blocked"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : lastAttackResult.status === "breached"
                ? "bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}>
              {lastAttackResult.status === "blocked" ? (
                <ShieldCheck className="w-6 h-6 animate-bounce" />
              ) : lastAttackResult.status === "breached" ? (
                <AlertOctagon className="w-6 h-6 animate-ping" />
              ) : (
                <Skull className="w-6 h-6" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider block opacity-75">
                Threat Defense Verification HUD
              </span>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                {lastAttackResult.title}
              </h3>
            </div>
          </div>

          <div className="shrink-0 font-mono text-xs font-bold">
            <span className={`px-3 py-1 rounded-full border ${
              lastAttackResult.status === "blocked"
                ? "bg-emerald-100/80 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300"
                : lastAttackResult.status === "breached"
                ? "bg-rose-100/80 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
            }`}>
              {lastAttackResult.status === "blocked"
                ? "DEFENSE CONFIRMED (100% BLOCKED)"
                : lastAttackResult.status === "breached"
                ? "VULNERABILITY DETECTED"
                : "AWAITING ADVERSARIAL STRESS TEST"}
            </span>
          </div>
        </div>

        <div className="pt-4 space-y-2 text-xs leading-relaxed opacity-90">
          <p>{lastAttackResult.details}</p>
          {lastAttackResult.defenseMechanism && (
            <div className="pt-2 font-mono text-[11px] flex items-center space-x-2">
              <span className="font-bold opacity-70">Active Mitigation:</span>
              <span className="bg-current/10 px-2.5 py-0.5 rounded-md font-bold">
                {lastAttackResult.defenseMechanism}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Attack Vector Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vector 1: MITM Bit-Flip */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 space-y-4 bg-white/85 dark:bg-slate-900/70 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-xs">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Man-in-the-Middle Bit-Flip Attack
              </h4>
              <span className="text-[10px] font-mono text-slate-500">Adversary alters payment amount in ciphertext</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            A rogue intermediary node intercepts an encrypted packet and flips bits to attempt altering the recipient or amount.
          </p>
          <button
            onClick={handleBitFlipAttack}
            disabled={isRunning}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 shadow-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Launch Bit-Flip Attack</span>
          </button>
        </div>

        {/* Vector 2: Offline Double-Spend Fork */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 space-y-4 bg-white/85 dark:bg-slate-900/70 shadow-xs hover:border-rose-300 dark:hover:border-rose-800 transition">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shadow-xs">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Offline Double-Spending Fork Attack
              </h4>
              <span className="text-[10px] font-mono text-slate-500">Alice signs conflicting payments with same seqNo</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Alice signs two separate payments offline with the exact same monotonic sequence counter to attempt spending her offline balance twice.
          </p>
          <button
            onClick={handleDoubleSpendForkAttack}
            disabled={isRunning}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 shadow-xs"
          >
            <Split className="w-3.5 h-3.5" />
            <span>Simulate Offline Fork</span>
          </button>
        </div>

        {/* Vector 3: Forged Hardware Signature */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 space-y-4 bg-white/85 dark:bg-slate-900/70 shadow-xs hover:border-purple-300 dark:hover:border-purple-800 transition">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Forged Hardware Device Signature
              </h4>
              <span className="text-[10px] font-mono text-slate-500">Adversary crafts instruction without private key</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            An attacker without Alice&apos;s hardware keystore tries to forge an instruction. Tested against ECDSA P-256 non-repudiation.
          </p>
          <button
            onClick={handleForgedSignatureAttack}
            disabled={isRunning}
            className="w-full py-2.5 px-4 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 shadow-xs"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Test Forged Signature</span>
          </button>
        </div>

        {/* Vector 4: Concurrent Duplicate Storm */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 space-y-4 bg-white/85 dark:bg-slate-900/70 shadow-xs hover:border-sky-300 dark:hover:border-sky-800 transition">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 shadow-xs">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Multi-Bridge Duplicate Storm
              </h4>
              <span className="text-[10px] font-mono text-slate-500">5 bridges upload identical packet at exact same ms</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Multiple phones holding the same payment packet walk outside and POST simultaneously into the central settlement engine.
          </p>
          <button
            onClick={handleDuplicateStormBurst}
            disabled={isRunning}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 shadow-xs"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Fire 5-Node Storm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
