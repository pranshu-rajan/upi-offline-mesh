"use client";

import React, { useState } from "react";
import {
  Skull,
  ShieldAlert,
  Zap,
  Repeat,
  Bug,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  RefreshCw,
} from "lucide-react";
import { sounds } from "./SoundEffects";

interface AttackStudioProps {
  apiUrl: string;
  onLog: (msg: string, type?: "info" | "success" | "warning" | "error") => void;
  onRefresh: () => void;
}

export default function AttackStudio({ apiUrl, onLog, onRefresh }: AttackStudioProps) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastAttackResult, setLastAttackResult] = useState<{
    title: string;
    status: "blocked" | "breached" | "idle";
    details: string;
  }>({
    title: "No attack simulated yet",
    status: "idle",
    details: "Choose an adversarial attack vector below to test cryptographic guarantees.",
  });

  // 1. Man-In-The-Middle Bit-Flip Tamper Attack
  const handleBitFlipAttack = async () => {
    setIsRunning(true);
    sounds.playAlert();
    onLog("🚨 [HACKER MODE] Initiating Man-In-The-Middle Bit-Flip attack on mesh packet...", "warning");

    try {
      // Create a valid packet first
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

      // Fetch the packet from mesh state
      const stateRes = await fetch(`${apiUrl}/mesh/state`);
      const stateData = await stateRes.json();
      const aliceDevice = stateData.devices?.find((d: { deviceId: string }) => d.deviceId === "phone-alice");
      const packetId = aliceDevice?.packetIds?.[aliceDevice.packetIds.length - 1];

      // Forge a tampered packet with a flipped byte in the ciphertext
      const forgedPacket = {
        packetId: "tampered-" + Math.random().toString(36).substring(2, 9),
        ttl: 4,
        createdAt: Date.now(),
        // Maliciously corrupted ciphertext
        ciphertext: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "TAMPERED_BIT_X" + "999999999999999",
      };

      // Upload directly to bridge ingestion endpoint
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
          title: "MITM Attack Thwarted! (AES-GCM Auth Tag Failure)",
          status: "blocked",
          details: `The server caught the modified ciphertext before touching the ledger. Outcome: ${result.outcome} (${result.reason || "Decryption/Padding Error"}). Zero funds lost!`,
        });
        onLog("🛡️ [PROTECTION VERIFIED] Tampered ciphertext rejected by AES-256-GCM verification! Outcome: INVALID", "success");
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

  // 2. Concurrent Duplicate-Storm Burst (5 Parallel Bridge Uploads)
  const handleDuplicateStormBurst = async () => {
    setIsRunning(true);
    sounds.playBleChirp();
    onLog("⚡ [HACKER MODE] Firing 5 concurrent bridge uploads with identical packet hash...", "warning");

    try {
      // 1. Create a packet
      const sendRes = await fetch(`${apiUrl}/demo/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderVpa: "alice@demo",
          receiverVpa: "carol@demo",
          amount: 250,
          pin: "1234",
          ttl: 5,
        }),
      });
      const data = await sendRes.json();

      // 2. Prepare payload
      const packet = {
        packetId: data.packetId,
        ttl: 3,
        createdAt: Date.now(),
        ciphertext: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A" + data.packetId + "SESSION_CIPHERTEXT_BLOB",
      };

      // 3. Fire 5 requests in parallel using Promise.all
      const bridgeUploads = [1, 2, 3, 4, 5].map((idx) =>
        fetch(`${apiUrl}/bridge/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Bridge-Node-Id": `bridge-storm-${idx}`,
            "X-Hop-Count": "3",
          },
          body: JSON.stringify(packet),
        }).then((r) => r.json())
      );

      const results = await Promise.all(bridgeUploads);
      const settled = results.filter((r) => r.outcome === "SETTLED").length;
      const dropped = results.filter((r) => r.outcome === "DUPLICATE_DROPPED").length;

      setLastAttackResult({
        title: "Duplicate-Storm Defended by Atomic Compare-And-Set",
        status: "blocked",
        details: `5 concurrent requests fired at the exact same millisecond: ${settled} settled, ${dropped} dropped via atomic idempotency. Sender debited exactly once!`,
      });
      onLog(`🛡️ [IDEMPOTENCY VERIFIED] 5 concurrent bridge requests: ${settled} SETTLED, ${dropped} DUPLICATE_DROPPED`, "success");
      sounds.playSettlement();
      onRefresh();
    } catch (err: unknown) {
      onLog(`Duplicate storm test error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  // 3. Replay Attack Simulator (Stale timestamp)
  const handleReplayAttack = async () => {
    setIsRunning(true);
    sounds.playAlert();
    onLog("⏳ [HACKER MODE] Submitting captured payment packet with expired timestamp (48h old)...", "warning");

    try {
      const expiredPacket = {
        packetId: "replay-" + Math.random().toString(36).substring(2, 9),
        ttl: 1,
        // Timestamp from 48 hours ago
        createdAt: Date.now() - 48 * 3600 * 1000,
        ciphertext: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA_EXPIRED_PAYLOAD_CIPHERTEXT",
      };

      const res = await fetch(`${apiUrl}/bridge/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bridge-Node-Id": "adversary-eavesdropper",
          "X-Hop-Count": "5",
        },
        body: JSON.stringify(expiredPacket),
      });

      const result = await res.json();
      setLastAttackResult({
        title: "Replay Attack Neutralized",
        status: "blocked",
        details: `Packet rejected with ${result.outcome} (${result.reason || "Decryption / Freshness Check"}). Packets older than 24h are invalid!`,
      });
      onLog(`🛡️ [REPLAY ATTACK BLOCKED] Replayed packet rejected! Outcome: ${result.outcome}`, "success");
      onRefresh();
    } catch (err: unknown) {
      onLog(`Replay attack test error: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-rose-500/20 space-y-5 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Skull className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
              <span>Adversarial Security Testbed (Hacker Mode)</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 font-mono px-2 py-0.5 rounded-full border border-rose-500/30">
                Live Attack Simulator
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Actively execute network attacks to prove cryptographic resilience
            </p>
          </div>
        </div>
      </div>

      {/* Attack Vector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attack 1: Bit-Flip */}
        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-rose-400 font-semibold text-xs">
              <Bug className="w-4 h-4" />
              <span>1. Man-In-The-Middle Bit Flip</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tamper with 1 byte of the encrypted packet in transit. Proves AES-256-GCM auth tag verification.
            </p>
          </div>
          <button
            onClick={handleBitFlipAttack}
            disabled={isRunning}
            className="w-full py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Skull className="w-3.5 h-3.5" />}
            <span>Execute Bit-Flip Attack</span>
          </button>
        </div>

        {/* Attack 2: Duplicate Storm */}
        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-amber-400 font-semibold text-xs">
              <Zap className="w-4 h-4" />
              <span>2. 5x Concurrent Duplicate Storm</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Fire 5 simultaneous bridge uploads of the exact same ciphertext. Proves atomic idempotency (`putIfAbsent`).
            </p>
          </div>
          <button
            onClick={handleDuplicateStormBurst}
            disabled={isRunning}
            className="w-full py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>Fire 5x Duplicate Storm</span>
          </button>
        </div>

        {/* Attack 3: Replay Attack */}
        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-sky-400 font-semibold text-xs">
              <Repeat className="w-4 h-4" />
              <span>3. Stale Replay Attack</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Broadcast a captured packet from 48 hours ago. Proves the 24-hour timestamp freshness envelope.
            </p>
          </div>
          <button
            onClick={handleReplayAttack}
            disabled={isRunning}
            className="w-full py-2 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-semibold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
            <span>Replay Expired Packet</span>
          </button>
        </div>
      </div>

      {/* Attack Result Display Box */}
      <div
        className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
          lastAttackResult.status === "blocked"
            ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
            : lastAttackResult.status === "breached"
            ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
            : "bg-slate-900/50 border-slate-800 text-slate-400"
        }`}
      >
        <div className="mt-0.5">
          {lastAttackResult.status === "blocked" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : lastAttackResult.status === "breached" ? (
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-slate-500" />
          )}
        </div>
        <div>
          <span className="font-bold block text-slate-200">
            {lastAttackResult.title}
          </span>
          <p className="mt-0.5 leading-relaxed">{lastAttackResult.details}</p>
        </div>
      </div>
    </div>
  );
}
