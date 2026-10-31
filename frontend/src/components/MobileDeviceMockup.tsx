"use client";

import React, { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  WifiOff,
  Battery,
  ShieldCheck,
  Send,
  QrCode,
  Sparkles,
  ArrowRightLeft,
  Key,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { sounds } from "./SoundEffects";

interface MobileDeviceMockupProps {
  senderVpa: string;
  setSenderVpa: (v: string) => void;
  receiverVpa: string;
  setReceiverVpa: (v: string) => void;
  amount: number;
  setAmount: (v: number) => void;
  pin: string;
  setPin: (v: string) => void;
  onInject: () => void;
  isInjecting: boolean;
  lastCiphertextPreview?: string | null;
  theme?: "light" | "dark";
}

export default function MobileDeviceMockup({
  senderVpa,
  setSenderVpa,
  receiverVpa,
  setReceiverVpa,
  amount,
  setAmount,
  pin,
  setPin,
  onInject,
  isInjecting,
  theme = "light",
}: MobileDeviceMockupProps) {
  const [showQr, setShowQr] = useState<boolean>(false);
  const isDark = theme === "dark";

  const qrPayload = useMemo(() => {
    return JSON.stringify({
      scheme: "upi-offline-mesh",
      sender: senderVpa,
      receiver: receiverVpa,
      amount,
      currency: "INR",
    });
  }, [senderVpa, receiverVpa, amount]);

  const handleKeypadPress = (digit: string) => {
    sounds.playClick();
    if (digit === "del") {
      setPin(pin.slice(0, -1));
    } else if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handleAuthorize = () => {
    sounds.playBleChirp();
    onInject();
  };

  return (
    <div className={`glass-panel rounded-3xl p-6 border shadow-lg relative flex flex-col items-center w-full max-w-sm transition-all duration-200 ${
      isDark
        ? "bg-slate-900/70 border-slate-800 text-slate-100"
        : "bg-white/80 border-slate-200/90 text-slate-900 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)]"
    }`}>
      {/* Header title */}
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isDark ? "bg-cyan-400" : "bg-indigo-600"}`} />
          <h3 className={`font-bold text-xs uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-800"}`}>
            Hardware Client: Phone Alice
          </h3>
        </div>
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
          isDark
            ? "bg-cyan-950/80 text-cyan-400 border-cyan-800"
            : "bg-indigo-50 text-indigo-600 border-indigo-200/80"
        }`}>
          ECDSA P-256 Secured
        </span>
      </div>

      {/* Smartphone Chassis */}
      <div className={`w-full max-w-[310px] rounded-[44px] p-2.5 relative overflow-hidden transition-all duration-200 ${
        isDark
          ? "bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-[5px] border-slate-800 shadow-2xl"
          : "bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 border-[5px] border-slate-300 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.2),0_0_0_1px_rgba(255,255,255,0.8)]"
      }`}>
        {/* Dynamic Island Pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-950 rounded-full z-30 flex items-center justify-between px-2.5 shadow-md">
          <div className="w-2 h-2 rounded-full bg-slate-800" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
        </div>

        {/* Screen Bezel */}
        <div className="w-full bg-white dark:bg-slate-950 rounded-[38px] p-4 pt-7 flex flex-col justify-between min-h-[500px] border border-slate-200/70 dark:border-slate-800/80 shadow-inner">
          {/* Status Bar */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1 mb-3 font-mono">
            <span>09:41</span>
            <div className="flex items-center space-x-1.5 text-rose-500 dark:text-rose-400">
              <span className="text-[10px] uppercase font-bold">No 4G</span>
              <WifiOff className="w-3.5 h-3.5" />
              <Battery className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            </div>
          </div>

          {/* App Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-900">
            <div className="flex items-center space-x-1.5">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                U
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                UPI Offline Lite
              </span>
            </div>
            <button
              onClick={() => setShowQr(!showQr)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 cursor-pointer transition"
              title="Toggle QR Code"
            >
              <QrCode className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
            </button>
          </div>

          {/* Main Content: Payment Form or QR */}
          {showQr ? (
            <div className="flex-1 flex flex-col items-center justify-center p-3 text-center space-y-3">
              <div className="p-3 bg-white rounded-2xl border-2 border-indigo-200 shadow-md">
                <QRCodeSVG value={qrPayload} size={150} />
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                Scan via BLE or Camera to accept offline payment
              </p>
              <button
                onClick={() => setShowQr(false)}
                className="text-xs font-bold text-indigo-600 dark:text-cyan-400 cursor-pointer"
              >
                Back to keypad
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between py-2 space-y-3">
              {/* Payment Details */}
              <div className="space-y-2">
                <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Sender: {senderVpa}</span>
                    <span className="text-emerald-500 font-bold">Offline Keystore</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">To:</span>
                    <input
                      type="text"
                      value={receiverVpa}
                      onChange={(e) => setReceiverVpa(e.target.value)}
                      className="font-mono text-xs font-bold text-right text-slate-800 dark:text-slate-100 bg-transparent focus:outline-hidden w-28"
                    />
                  </div>
                </div>

                {/* Amount Display */}
                <div className="text-center py-2">
                  <span className="text-xs text-slate-400 block font-medium">Amount</span>
                  <div className="flex items-center justify-center space-x-1 font-mono">
                    <span className="text-xl font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white bg-transparent text-center focus:outline-hidden w-32"
                    />
                  </div>
                </div>

                {/* PIN Dots Display */}
                <div className="flex items-center justify-center space-x-2 py-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-2.5 h-2.5 rounded-full border transition-all ${
                        pin.length > idx
                          ? "bg-indigo-600 dark:bg-cyan-400 border-indigo-600 dark:border-cyan-400 scale-110 shadow-xs"
                          : "border-slate-300 dark:border-slate-700 bg-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono font-bold text-xs select-none">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "del"].map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      if (k === "C") setPin("");
                      else handleKeypadPress(k);
                    }}
                    type="button"
                    className="py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-800/60 active:scale-95 transition cursor-pointer"
                  >
                    {k === "del" ? "⌫" : k}
                  </button>
                ))}
              </div>

              {/* Authorize & Broadcast Action Button */}
              <button
                onClick={handleAuthorize}
                disabled={isInjecting || pin.length < 4}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-40 shadow-md shadow-indigo-500/25 active:scale-98"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isInjecting ? "Signing & Encrypting..." : "Sign & Broadcast to Mesh"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
