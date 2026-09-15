"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Trash2,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  StopCircle,
  Shield,
  Radio,
  Lock,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sounds } from "./SoundEffects";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STARTER_PROMPTS = [
  {
    icon: Lock,
    title: "Hybrid Cryptography",
    prompt: "How does RSA-2048 OAEP and AES-256-GCM encryption protect payments across untrusted mesh nodes?",
  },
  {
    icon: Radio,
    title: "Store-and-Forward Gossip",
    prompt: "Explain how BLE store-and-forward gossip routing delivers offline packets to an internet bridge.",
  },
  {
    icon: Shield,
    title: "Double-Spend Defense",
    prompt: "How does the settlement engine prevent double-spending and replay attacks if a packet is intercepted?",
  },
  {
    icon: Zap,
    title: "Attack Studio Breakdown",
    prompt: "What happens during the Replay and Tamper attacks in the Security Attack Studio?",
  },
];

function getTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function generateMsgId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

async function streamResponse(
  body: ReadableStream<Uint8Array>,
  onUpdate: (fullText: string) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText = fullText + chunk;
    onUpdate(fullText);
  }
}

export default function MeshAiChatbot({
  isOpen,
  onToggle,
  theme = "light",
}: {
  isOpen: boolean;
  onToggle: () => void;
  theme?: "light" | "dark";
}) {
  const isDark = theme === "dark";
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      role: "assistant",
      content: `👋 **Welcome to the UPI Offline Mesh AI Assistant!**

I can explain the cryptographic protocol, store-and-forward gossip mesh, anti-replay protections, or guide you through the Attack Studio.

Try one of the quick prompts below or ask any question!`,
      timestamp: getTimestamp(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming chunks
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Copy code block helper
  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      sounds.playClick();
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Abort streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Send message
  const handleSend = async (userText?: string) => {
    const query = (userText || input).trim();
    if (!query || isStreaming) return;

    sounds.playBleChirp();

    const userMessage: ChatMessage = {
      id: generateMsgId("user"),
      role: "user",
      content: query,
      timestamp: getTimestamp(),
    };

    const assistantPlaceholderId = generateMsgId("assistant");
    const initialAssistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      timestamp: getTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setInput("");
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Build conversation history payload
      const conversationPayload = [
        ...messages
          .filter((m) => m.id !== "welcome-1")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: query },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationPayload }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to connect to AI service" }));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No readable stream received from server");
      }

      await streamResponse(res.body, (fullText) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? { ...msg, content: fullText }
              : msg
          )
        );
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped generation manually
      } else {
        const errorText = `⚠️ **Error**: ${
          err instanceof Error ? err.message : "Failed to fetch response"
        }`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? { ...msg, content: msg.content ? `${msg.content}\n\n${errorText}` : errorText }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    sounds.playClick();
    setMessages([
      {
        id: "welcome-1",
        role: "assistant",
        content: `Conversation cleared. Ask me anything about the **UPI Offline Mesh** architecture!`,
        timestamp: getTimestamp(),
      },
    ]);
  };

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={() => {
            sounds.playClick();
            onToggle();
          }}
          className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-600 text-white shadow-xl shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group border border-indigo-400/40"
          aria-label="Open AI Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white animate-bounce" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
          </div>
          <span className="font-bold text-xs tracking-wide">Ask Mesh AI</span>
          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono text-white font-semibold">
            Streaming
          </span>
        </button>
      )}

      {/* Slide-Over / Floating Modal Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col backdrop-blur-2xl border shadow-2xl rounded-3xl overflow-hidden ${
            isExpanded
              ? "inset-4 sm:inset-8"
              : "bottom-4 right-4 w-[94vw] sm:w-[460px] h-[640px] max-h-[88vh]"
          } ${
            isDark
              ? "bg-slate-950/95 border-slate-800 text-slate-100"
              : "bg-white/95 border-slate-200 text-slate-900"
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3.5 border-b ${
            isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50/90 border-slate-200"
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm ${
                isDark
                  ? "bg-gradient-to-tr from-cyan-600 to-indigo-600"
                  : "bg-gradient-to-tr from-indigo-600 to-indigo-700"
              }`}>
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className={`text-xs font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    UPI Mesh AI Specialist
                  </h3>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                    isDark
                      ? "bg-cyan-950/80 text-cyan-300 border-cyan-800"
                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  }`}>
                    Live Copilot
                  </span>
                </div>
                <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Protocol Verification & Architecture Guide
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleClearHistory}
                title="Clear Chat History"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDark ? "text-slate-400 hover:text-rose-400 hover:bg-slate-800" : "text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse Window" : "Expand Window"}
                className={`p-1.5 rounded-lg transition cursor-pointer hidden sm:block ${
                  isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onToggle();
                }}
                title="Close Assistant"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans select-text ${
            isDark ? "bg-slate-950/60" : "bg-slate-50/40"
          }`}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex space-x-2.5 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm border ${
                    isDark
                      ? "bg-cyan-950/80 border-cyan-800 text-cyan-400"
                      : "bg-indigo-50 border-indigo-200 text-indigo-600"
                  }`}>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm leading-relaxed ${
                    msg.role === "user"
                      ? isDark
                        ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-tr-none"
                        : "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none"
                      : isDark
                      ? "bg-slate-900/90 text-slate-100 rounded-tl-none border border-slate-800"
                      : "bg-white text-slate-800 rounded-tl-none border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  }`}
                >
                  {/* Content with Markdown-like Formatting */}
                  <FormattedMessageContent
                    content={msg.content}
                    onCopyCode={handleCopyCode}
                    copiedCodeId={copiedCodeId}
                  />

                  {/* Streaming pulse indicator */}
                  {isStreaming && msg.role === "assistant" && msg.content && (
                    <span className={`inline-block w-2 h-3.5 ml-1 animate-pulse align-middle ${
                      isDark ? "bg-cyan-400" : "bg-indigo-600"
                    }`} />
                  )}

                  <div
                    className={`mt-1.5 text-[9px] font-mono text-right ${
                      msg.role === "user" ? (isDark ? "text-cyan-200" : "text-indigo-200") : "text-slate-400"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm border ${
                    isDark
                      ? "bg-slate-800 text-slate-300 border-slate-700"
                      : "bg-slate-200 text-slate-700 border-slate-300"
                  }`}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {/* Waiting for first stream token */}
            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className={`flex items-center space-x-2 text-xs py-2 ${
                isDark ? "text-cyan-400" : "text-indigo-600"
              }`}>
                <Sparkles className="w-4 h-4 animate-spin" />
                <span className="animate-pulse font-medium">Synthesizing verified protocol response...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Starter Prompts */}
          {messages.length <= 2 && !isStreaming && (
            <div className={`px-4 py-2.5 border-t ${
              isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white"
            }`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Suggested Topics:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {STARTER_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.prompt)}
                      className={`text-left px-2.5 py-1.5 rounded-xl border transition text-[11px] flex items-center space-x-2 cursor-pointer group shadow-sm ${
                        isDark
                          ? "bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-cyan-600/50 text-slate-300 hover:text-cyan-300"
                          : "bg-slate-50 hover:bg-indigo-50/80 border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-900"
                      }`}
                    >
                      <Icon className={`w-3 h-3 group-hover:scale-110 transition shrink-0 ${
                        isDark ? "text-cyan-400" : "text-indigo-600"
                      }`} />
                      <span className="truncate font-semibold">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className={`p-3 border-t ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
          }`}>
            <div className="relative flex items-end space-x-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about RSA-OAEP, AES-GCM, BLE hop gossip, replay defense..."
                rows={1}
                disabled={isStreaming}
                className={`flex-1 min-h-[42px] max-h-32 px-3.5 py-2.5 border rounded-2xl text-xs resize-none outline-none disabled:opacity-50 ${
                  isDark
                    ? "bg-slate-900/90 border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
                }`}
              />

              {isStreaming ? (
                <button
                  onClick={handleStopStreaming}
                  className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-md shadow-rose-600/20 shrink-0 tactile-btn"
                  title="Stop Generating"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className={`p-2.5 rounded-xl text-white transition cursor-pointer shadow-md shrink-0 tactile-btn ${
                    isDark
                      ? "bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 shadow-cyan-600/20"
                      : "bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-indigo-600/20"
                  }`}
                  title="Send Question"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>Press <kbd className={`px-1 py-0.5 rounded font-mono text-[9px] border ${
                isDark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
              }`}>Enter</kbd> to send</span>
              <span className={`font-mono font-medium ${isDark ? "text-cyan-400" : "text-emerald-600"}`}>Groq AI Streaming</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Robust markdown formatter that renders tables, code blocks, lists and blockquotes in crisp Light Theme
 */
function FormattedMessageContent({
  content,
  onCopyCode,
  copiedCodeId,
}: {
  content: string;
  onCopyCode: (code: string, id: string) => void;
  copiedCodeId: string | null;
}) {
  if (!content) return null;

  return (
    <div className="text-xs leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-slate-50 text-indigo-900 font-bold uppercase tracking-wider text-[10px]">
                {children}
              </thead>
            );
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-slate-100">{children}</tbody>;
          },
          tr({ children }) {
            return (
              <tr className="hover:bg-slate-50/70 transition-colors odd:bg-white even:bg-slate-50/30">
                {children}
              </tr>
            );
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 text-indigo-900 font-bold border-b border-slate-200 whitespace-nowrap">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 text-slate-700 border-b border-slate-100 leading-normal">
                {children}
              </td>
            );
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isInline = !className && !codeString.includes("\n");

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-indigo-700 font-semibold"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const blockId = `code-${Math.random().toString(36).substring(2, 8)}`;
            return (
              <div className="my-2.5 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 font-mono text-[11px] shadow-sm">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px]">
                  <span className="uppercase font-semibold tracking-wider text-indigo-400">
                    {match ? match[1] : "code"}
                  </span>
                  <button
                    onClick={() => onCopyCode(codeString, blockId)}
                    className="flex items-center space-x-1 hover:text-white transition cursor-pointer text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded"
                  >
                    {copiedCodeId === blockId ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto text-emerald-400 whitespace-pre leading-relaxed">
                  <code>{codeString}</code>
                </pre>
              </div>
            );
          },
          h1({ children }) {
            return (
              <h2 className="text-base font-extrabold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200">
                {children}
              </h2>
            );
          },
          h2({ children }) {
            return (
              <h3 className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5 pb-0.5 border-b border-slate-100">
                {children}
              </h3>
            );
          },
          h3({ children }) {
            return (
              <h4 className="text-xs font-bold text-indigo-700 mt-3 mb-1 tracking-wide">
                {children}
              </h4>
            );
          },
          ul({ children }) {
            return (
              <ul className="space-y-1 my-1.5 list-disc list-outside ml-4 text-slate-700">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="space-y-1 my-1.5 list-decimal list-outside ml-4 text-slate-700 font-medium">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="leading-relaxed pl-1">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 pl-3 border-l-2 border-indigo-500 bg-indigo-50/50 py-1.5 rounded-r text-slate-700 italic text-[11px]">
                {children}
              </blockquote>
            );
          },
          p({ children }) {
            return <p className="leading-relaxed my-1.5 text-slate-700">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-bold text-slate-900">{children}</strong>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 font-medium"
              >
                {children}
              </a>
            );
          },
          hr() {
            return <hr className="my-3 border-slate-200" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
