"use client";

import React, { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  WifiOff,
  Battery,
  ShieldCheck,
  Send,
  QrCode,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
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

  // Pure memoized QR payload compliant with React 19 rules
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
            Hardware Mockup: Phone Alice
          </h3>
        </div>
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
          isDark
            ? "bg-cyan-950/80 text-cyan-400 border-cyan-800"
            : "bg-indigo-50 text-indigo-600 border-indigo-200/80"
        }`}>
          BLE Transmitter
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

        {/* Smartphone Screen Canvas */}
        <div className={`rounded-[36px] pt-7 pb-4 px-4 min-h-[560px] flex flex-col justify-between border shadow-sm transition-colors ${
          isDark
            ? "bg-slate-950 text-slate-100 border-slate-900"
            : "bg-white text-slate-800 border-slate-200"
        }`}>
          {/* Status Bar */}
          <div className={`flex items-center justify-between text-[11px] px-1 mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>09:41</span>
            <div className="flex items-center space-x-1.5">
              <span className={`flex items-center space-x-1 font-mono text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${
                isDark
                  ? "bg-amber-950/60 text-amber-400 border-amber-800/80"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <WifiOff className="w-2.5 h-2.5 text-amber-500" />
                <span>OFFLINE MESH</span>
              </span>
              <Battery className={`w-3.5 h-3.5 ${isDark ? "text-slate-400" : "text-slate-600"}`} />
            </div>
          </div>

          {/* App Header */}
          <div className="text-center space-y-1 mb-2">
            <div className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isDark
                ? "bg-emerald-950/60 border-emerald-800 text-emerald-400"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}>
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Offline UPI SafePay</span>
            </div>
            <h4 className={`text-sm font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Instant Encrypted Transfer
            </h4>
          </div>

          {/* Body: Form vs Offline QR Code */}
          {showQr ? (
            <div className={`rounded-2xl p-4 border text-center space-y-3 my-auto shadow-sm ${
              isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}>
              <div className={`flex items-center justify-center space-x-1 text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <QrCode className={`w-4 h-4 ${isDark ? "text-cyan-400" : "text-indigo-600"}`} />
                <span>Offline Merchant QR Code</span>
              </div>
              <div className="bg-white p-3 rounded-2xl inline-block shadow-md border border-slate-100 mx-auto">
                <QRCodeSVG value={qrPayload} size={145} level="M" />
              </div>
              <p className={`text-[11px] font-mono font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                ₹{amount.toFixed(2)} to {receiverVpa}
              </p>
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowQr(false);
                }}
                className={`text-xs font-semibold hover:underline cursor-pointer ${isDark ? "text-cyan-400 hover:text-cyan-300" : "text-indigo-600 hover:text-indigo-800"}`}
              >
                ← Return to Keypad
              </button>
            </div>
          ) : (
            <div className="space-y-3 my-auto">
              {/* Account Routing Selection Box */}
              <div className={`rounded-2xl p-3 border space-y-2 text-xs ${
                isDark ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    From (Sender)
                  </span>
                  <select
                    value={senderVpa}
                    onChange={(e) => setSenderVpa(e.target.value)}
                    className={`font-mono text-[11px] font-bold border rounded-lg px-2 py-0.5 focus:outline-none shadow-sm ${
                      isDark
                        ? "bg-slate-950 text-cyan-400 border-slate-700"
                        : "bg-white text-indigo-700 border-slate-200 focus:ring-1 focus:ring-indigo-500"
                    }`}
                  >
                    <option value="alice@demo" className={isDark ? "bg-slate-900" : "bg-white"}>alice@demo</option>
                    <option value="bob@demo" className={isDark ? "bg-slate-900" : "bg-white"}>bob@demo</option>
                    <option value="carol@demo" className={isDark ? "bg-slate-900" : "bg-white"}>carol@demo</option>
                  </select>
                </div>

                <div className="flex items-center justify-center py-0.5">
                  <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    To (Recipient)
                  </span>
                  <select
                    value={receiverVpa}
                    onChange={(e) => setReceiverVpa(e.target.value)}
                    className={`font-mono text-[11px] font-bold border rounded-lg px-2 py-0.5 focus:outline-none shadow-sm ${
                      isDark
                        ? "bg-slate-950 text-emerald-400 border-slate-700"
                        : "bg-white text-emerald-700 border-slate-200 focus:ring-1 focus:ring-emerald-500"
                    }`}
                  >
                    <option value="bob@demo" className={isDark ? "bg-slate-900" : "bg-white"}>bob@demo</option>
                    <option value="carol@demo" className={isDark ? "bg-slate-900" : "bg-white"}>carol@demo</option>
                    <option value="alice@demo" className={isDark ? "bg-slate-900" : "bg-white"}>alice@demo</option>
                    <option value="dave@demo" className={isDark ? "bg-slate-900" : "bg-white"}>dave@demo</option>
                  </select>
                </div>
              </div>

              {/* Amount Display */}
              <div className="text-center py-1">
                <span className={`text-[10px] uppercase font-bold tracking-wider block mb-0.5 ${isDark ? "text-slate-400" : "text-slate-400"}`}>
                  Transfer Amount
                </span>
                <div className={`flex items-center justify-center font-extrabold text-2xl font-mono ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                  <span>₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className={`w-28 bg-transparent text-center focus:outline-none border-b-2 pb-0.5 font-bold ${
                      isDark ? "border-emerald-500/50" : "border-emerald-400/60"
                    }`}
                  />
                </div>
              </div>

              {/* 4-digit PIN Indicator */}
              <div className="text-center">
                <span className={`text-[10px] font-semibold block mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  UPI Security PIN
                </span>
                <div className="flex justify-center space-x-2.5">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        idx < pin.length
                          ? isDark
                            ? "bg-cyan-400 scale-110 shadow-sm shadow-cyan-400 ring-2 ring-cyan-900"
                            : "bg-indigo-600 scale-110 shadow-sm shadow-indigo-300 ring-2 ring-indigo-200"
                          : isDark
                          ? "bg-slate-800 border border-slate-700"
                          : "bg-slate-100 border border-slate-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "QR", "0", "del"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === "QR") {
                        sounds.playClick();
                        setShowQr(true);
                      } else {
                        handleKeypadPress(k);
                      }
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm ${
                      k === "QR"
                        ? isDark
                          ? "bg-cyan-950/60 text-cyan-300 border border-cyan-800 hover:bg-cyan-900/60 flex items-center justify-center"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center hover:bg-indigo-100"
                        : k === "del"
                        ? isDark
                          ? "bg-rose-950/40 text-rose-400 border border-rose-900 hover:bg-rose-900/40"
                          : "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                        : isDark
                        ? "bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80"
                    }`}
                  >
                    {k === "QR" ? <QrCode className={`w-3.5 h-3.5 ${isDark ? "text-cyan-400" : "text-indigo-600"}`} /> : k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              onClick={() => {
                sounds.playBleChirp();
                onInject();
              }}
              disabled={isInjecting}
              className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition tactile-btn cursor-pointer disabled:opacity-50 text-white ${
                isDark
                  ? "bg-gradient-to-r from-cyan-600 via-indigo-600 to-cyan-600 hover:from-cyan-500 hover:to-indigo-500 shadow-cyan-500/20"
                  : "bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-600 hover:from-indigo-700 hover:to-indigo-800 shadow-indigo-500/25"
              }`}
            >
              {isInjecting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Broadcast Encrypted Packet</span>
            </button>
          </div>
        </div>
      </div>

      <div className={`flex items-center space-x-1.5 text-[11px] mt-3 font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        <Sparkles className={`w-3 h-3 ${isDark ? "text-cyan-400" : "text-indigo-500"}`} />
        <span>Simulating offline Phone Alice</span>
      </div>
    </div>
  );
}
