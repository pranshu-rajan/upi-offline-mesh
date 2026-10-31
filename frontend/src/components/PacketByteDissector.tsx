"use client";

import React, { useState } from "react";
import {
  Lock,
  Key,
  ShieldAlert,
  ShieldCheck,
  Binary,
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { sounds } from "./SoundEffects";

interface PacketByteDissectorProps {
  ciphertextPreview: string | null;
  theme?: "light" | "dark";
  onTamperSimulate?: () => void;
}

export default function PacketByteDissector({
  ciphertextPreview,
  theme = "light",
  onTamperSimulate,
}: PacketByteDissectorProps) {
  const isDark = theme === "dark";
  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("rsa");
  const [tamperedByteIndex, setTamperedByteIndex] = useState<number | null>(null);

  if (!ciphertextPreview) {
    return (
      <div className="glass-panel rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 text-center space-y-3 bg-white/70 dark:bg-slate-900/60 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto shadow-xs">
          <Binary className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Cryptographic Wire Protocol Dissector
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          No offline payment packet generated yet. Authorize an offline payment in the phone simulator to inspect the raw hybrid byte tree.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(ciphertextPreview);
    setCopied(true);
    sounds.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (sec: string) => {
    sounds.playClick();
    setExpandedSection(expandedSection === sec ? null : sec);
  };

  const handleSimulateBitFlip = () => {
    sounds.playAlert();
    setTamperedByteIndex(128); // Corrupt byte at index 128
    if (onTamperSimulate) {
      onTamperSimulate();
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 border border-indigo-200/90 dark:border-indigo-500/30 shadow-[0_8px_32px_-4px_rgba(99,102,241,0.12)] space-y-5 bg-white/90 dark:bg-slate-900/80">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-cyan-400 border border-indigo-200 dark:border-indigo-800 shadow-xs">
            <Binary className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                Wire Protocol & Byte Dissector (Wireshark-Grade)
              </h3>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                AES-256-GCM / 128-bit TAG
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive structural breakdown of the hybrid envelope transmitted across untrusted relays
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition cursor-pointer shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-cyan-400" />
                <span>Copy Raw Blob</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Raw Hex/Base64 Monolithic Window */}
      <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 shadow-inner space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Wire Packet Stream (Base64)</span>
          </span>
          <span>Length: ~{ciphertextPreview.length} chars</span>
        </div>
        <div className="text-[11px] font-mono break-all leading-relaxed max-h-24 overflow-y-auto text-emerald-400">
          {tamperedByteIndex !== null ? (
            <span>
              {ciphertextPreview.substring(0, 48)}
              <span className="bg-rose-500/40 text-rose-300 px-1 rounded font-bold underline animate-pulse">
                [BIT_FLIPPED_CORRUPTED]
              </span>
              {ciphertextPreview.substring(72)}
            </span>
          ) : (
            ciphertextPreview
          )}
        </div>
      </div>

      {/* Interactive Byte Anatomy Tree */}
      <div className="space-y-3">
        {/* Layer 1: RSA-2048 OAEP Wrapped Key */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/70 dark:bg-slate-950/50 transition">
          <button
            onClick={() => toggleSection("rsa")}
            className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition"
          >
            <div className="flex items-center space-x-3">
              {expandedSection === "rsa" ? (
                <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                [0x0000 - 0x0100] RSA-2048 OAEP Wrapped Session Key (256 Bytes)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-cyan-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
              KID: 0x2048_SERVER
            </span>
          </button>
          {expandedSection === "rsa" && (
            <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-300 space-y-2 border-t border-slate-200/60 dark:border-slate-800/80">
              <p className="leading-relaxed">
                Contains the ephemeral 256-bit AES key encrypted with the Settlement Server&apos;s RSA-2048 public key via OAEP padding (SHA-256 + MGF1). Intermediary Bluetooth relay nodes have zero knowledge and cannot read this key.
              </p>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                Algorithm: RSA/ECB/OAEPWithSHA-256AndMGF1Padding • Block Size: 256 Bytes
              </div>
            </div>
          )}
        </div>

        {/* Layer 2: AES-GCM IV Nonce */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/70 dark:bg-slate-950/50 transition">
          <button
            onClick={() => toggleSection("iv")}
            className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition"
          >
            <div className="flex items-center space-x-3">
              {expandedSection === "iv" ? (
                <ChevronDown className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                [0x0101 - 0x010C] AES-GCM Initialization Vector (12 Bytes / 96-bit IV)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-full">
              Random CSPRNG
            </span>
          </button>
          {expandedSection === "iv" && (
            <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-300 space-y-2 border-t border-slate-200/60 dark:border-slate-800/80">
              <p className="leading-relaxed">
                Cryptographically secure pseudorandom 96-bit initialization vector guaranteeing unique keystream generation per packet, eliminating replay dictionary attacks.
              </p>
            </div>
          )}
        </div>

        {/* Layer 3: Authenticated Ciphertext + 128-bit Tag */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/70 dark:bg-slate-950/50 transition">
          <button
            onClick={() => toggleSection("tag")}
            className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition"
          >
            <div className="flex items-center space-x-3">
              {expandedSection === "tag" ? (
                <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                [0x010D - END] Payload Ciphertext + 128-bit GCM Auth Tag (16 Bytes)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
              Tamper-Proof
            </span>
          </button>
          {expandedSection === "tag" && (
            <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-300 space-y-3 border-t border-slate-200/60 dark:border-slate-800/80">
              <p className="leading-relaxed">
                Contains the payment instructions: sender VPA, receiver VPA, amount, monotonic sequence counter, timestamp, and ECDSA signature. Galois authentication tag detects any in-transit bit tampering.
              </p>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-mono text-[11px]">Simulate Man-In-The-Middle Bit Flip:</span>
                <button
                  onClick={handleSimulateBitFlip}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition cursor-pointer shadow-xs flex items-center space-x-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Flip Bit 128</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

