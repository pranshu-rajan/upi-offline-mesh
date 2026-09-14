"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  WifiOff,
  Battery,
  ShieldCheck,
  Send,
  Lock,
  QrCode,
  Smartphone,
  ChevronDown,
  RefreshCw,
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
  lastCiphertextPreview: string | null;
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
  lastCiphertextPreview,
}: MobileDeviceMockupProps) {
  const [showQr, setShowQr] = useState<boolean>(false);

  const qrPayload = JSON.stringify({
    scheme: "upi-offline-mesh",
    sender: senderVpa,
    receiver: receiverVpa,
    amount,
    timestamp: Date.now(),
  });

  const handleKeypadPress = (digit: string) => {
    sounds.playClick();
    if (digit === "del") {
      setPin(pin.slice(0, -1));
    } else if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-5 border border-slate-800 shadow-2xl relative flex flex-col items-center">
      {/* Smartphone Frame Outer Bezel */}
      <div className="w-full max-w-[320px] bg-slate-950 rounded-[40px] border-4 border-slate-700/80 p-3 shadow-2xl shadow-indigo-500/10 relative overflow-hidden">
        {/* Dynamic Island / Speaker Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-900 rounded-full z-30 flex items-center justify-end px-2">
          <div className="w-2 h-2 rounded-full bg-slate-800" />
        </div>

        {/* Phone Screen Canvas */}
        <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 rounded-[32px] pt-8 pb-4 px-4 min-h-[580px] flex flex-col justify-between border border-slate-800/60 text-slate-100">
          {/* Status Bar */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-3">
            <span className="font-semibold text-slate-300">09:41</span>
            <div className="flex items-center space-x-2">
              <span className="flex items-center space-x-1 text-amber-400 font-mono text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE MESH</span>
              </span>
              <Battery className="w-3.5 h-3.5 text-slate-300" />
            </div>
          </div>

          {/* App Header */}
          <div className="text-center space-y-1 mb-2">
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              <span>Offline UPI SafePay</span>
            </div>
            <h4 className="text-sm font-bold text-slate-100">Send Encrypted Money</h4>
          </div>

          {/* Body Toggle: Form vs QR Code */}
          {showQr ? (
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 text-center space-y-3 my-auto">
              <span className="text-xs font-semibold text-slate-300">
                Offline Merchant QR Code
              </span>
              <div className="bg-white p-3 rounded-xl inline-block shadow-lg mx-auto">
                <QRCodeSVG value={qrPayload} size={150} level="M" />
              </div>
              <p className="text-[10px] text-slate-400">
                ₹{amount} to {receiverVpa}
              </p>
              <button
                onClick={() => {
                  sounds.playClick();
                  setShowQr(false);
                }}
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Back to keypad
              </button>
            </div>
          ) : (
            <div className="space-y-3 my-auto">
              {/* Sender & Receiver Pickers */}
              <div className="bg-slate-900/70 rounded-xl p-2.5 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">From (Your VPA):</span>
                  <select
                    value={senderVpa}
                    onChange={(e) => setSenderVpa(e.target.value)}
                    className="bg-transparent text-indigo-300 font-mono text-[11px] font-semibold focus:outline-none"
                  >
                    <option value="alice@demo" className="bg-slate-900">alice@demo</option>
                    <option value="bob@demo" className="bg-slate-900">bob@demo</option>
                    <option value="carol@demo" className="bg-slate-900">carol@demo</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400">To:</span>
                  <select
                    value={receiverVpa}
                    onChange={(e) => setReceiverVpa(e.target.value)}
                    className="bg-transparent text-emerald-400 font-mono text-[11px] font-semibold focus:outline-none"
                  >
                    <option value="bob@demo" className="bg-slate-900">bob@demo</option>
                    <option value="carol@demo" className="bg-slate-900">carol@demo</option>
                    <option value="alice@demo" className="bg-slate-900">alice@demo</option>
                    <option value="dave@demo" className="bg-slate-900">dave@demo</option>
                  </select>
                </div>
              </div>

              {/* Amount Display */}
              <div className="text-center py-2">
                <span className="text-xs text-slate-400 block mb-1">Enter Amount</span>
                <div className="flex items-center justify-center font-bold text-2xl text-emerald-400 font-mono">
                  <span>₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-28 bg-transparent text-center focus:outline-none border-b border-dashed border-emerald-500/40"
                  />
                </div>
              </div>

              {/* 4-digit PIN Dots */}
              <div className="text-center">
                <span className="text-[10px] text-slate-400 block mb-1.5">UPI PIN</span>
                <div className="flex justify-center space-x-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        idx < pin.length
                          ? "bg-indigo-400 scale-110 shadow-sm shadow-indigo-400"
                          : "bg-slate-800 border border-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Numerical Keypad */}
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
                    className={`py-2 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer ${
                      k === "QR"
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center"
                        : k === "del"
                        ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        : "bg-slate-900/80 text-slate-200 hover:bg-slate-800 border border-slate-800/80"
                    }`}
                  >
                    {k === "QR" ? <QrCode className="w-3.5 h-3.5" /> : k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={() => {
                sounds.playBleChirp();
                onInject();
              }}
              disabled={isInjecting}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50"
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
      <p className="text-[11px] text-slate-500 mt-2 font-mono">Simulating Phone Alice</p>
    </div>
  );
}
