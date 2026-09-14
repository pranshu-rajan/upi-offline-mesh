"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
  Maximize2,
  Minimize2,
  StopCircle,
  HelpCircle,
  Shield,
  Radio,
  Lock,
  Zap,
} from "lucide-react";
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

export default function MeshAiChatbot({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: `👋 **Welcome to the UPI Offline Mesh AI Assistant!**

I can explain the cryptographic protocol, store-and-forward gossip mesh, anti-replay protections, or guide you through the Attack Studio.

Try one of the quick prompts below or ask any question!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantPlaceholderId = `assistant-${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? { ...msg, content: accumulatedText }
              : msg
          )
        );
      }
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
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
          className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group border border-indigo-400/30"
          aria-label="Open AI Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white animate-bounce" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
          </div>
          <span className="font-semibold text-xs tracking-wide">Ask Mesh AI</span>
          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono text-indigo-100">
            Groq
          </span>
        </button>
      )}

      {/* Slide-Over / Floating Modal Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl shadow-black/80 rounded-2xl overflow-hidden ${
            isExpanded
              ? "inset-4 sm:inset-8"
              : "bottom-4 right-4 w-[94vw] sm:w-[460px] h-[640px] max-h-[88vh]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-950/80 border-b border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    UPI Mesh AI Specialist
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Groq Streaming
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Llama 3.3 70B • Line-by-Line Formatted
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleClearHistory}
                title="Clear Chat History"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Collapse Window" : "Expand Window"}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer hidden sm:block"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  sounds.playClick();
                  onToggle();
                }}
                title="Close Assistant"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans select-text">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex space-x-2.5 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none border border-indigo-400/20"
                      : "bg-slate-800/80 text-slate-100 rounded-tl-none border border-slate-700/60 leading-relaxed"
                  }`}
                >
                  {/* Content with Markdown-like Formatting */}
                  <FormattedMessageContent
                    content={msg.content}
                    onCopyCode={handleCopyCode}
                    copiedCodeId={copiedCodeId}
                  />

                  {/* Streaming indicator */}
                  {isStreaming && msg.role === "assistant" && msg.content && (
                    <span className="inline-block w-2 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
                  )}

                  <div
                    className={`mt-1.5 text-[9px] font-mono text-right ${
                      msg.role === "user" ? "text-indigo-200/70" : "text-slate-400"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 border border-slate-600">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {/* Waiting for first stream token */}
            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex items-center space-x-2 text-indigo-400 text-xs py-2">
                <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="animate-pulse">Synthesizing verified protocol response...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Starter Chips (shown when few messages) */}
          {messages.length <= 2 && !isStreaming && (
            <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/40">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                Suggested Questions:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {STARTER_PROMPTS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(item.prompt)}
                      className="text-left px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-indigo-950/40 border border-slate-700/60 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-200 transition text-[11px] flex items-center space-x-2 cursor-pointer group"
                    >
                      <Icon className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition shrink-0" />
                      <span className="truncate font-medium">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 bg-slate-950/90 border-t border-slate-800">
            <div className="relative flex items-end space-x-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about offline mesh, RSA/AES, replay defense..."
                rows={1}
                disabled={isStreaming}
                className="flex-1 min-h-[42px] max-h-32 px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-400 resize-none outline-none disabled:opacity-50"
              />

              {isStreaming ? (
                <button
                  onClick={handleStopStreaming}
                  className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-lg shadow-rose-600/30 shrink-0"
                  title="Stop Generating"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition cursor-pointer shadow-lg shadow-indigo-600/30 shrink-0"
                  title="Send Question"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-[9px]">Enter</kbd> to send</span>
              <span className="font-mono text-emerald-400/80">Groq API Powered</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Robust markdown formatter that cleanly renders headers, code blocks,
 * bullet lists, numbered lists, blockquotes, and inline formatting line-by-line
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

  // Split into lines while preserving code block integrity
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeBuffer: string[] = [];
  let codeBlockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect code fence start / end
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End of code block
        const codeText = codeBuffer.join("\n");
        const blockId = `code-${codeBlockIndex++}`;
        elements.push(
          <div
            key={blockId}
            className="my-2.5 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 font-mono text-[11px]"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px]">
              <span className="uppercase font-semibold tracking-wider">
                {codeLanguage || "code"}
              </span>
              <button
                onClick={() => onCopyCode(codeText, blockId)}
                className="flex items-center space-x-1 hover:text-white transition cursor-pointer text-[10px]"
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
            <pre className="p-3 overflow-x-auto text-emerald-300/90 whitespace-pre leading-relaxed">
              <code>{codeText}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBuffer = [];
        codeLanguage = "";
      } else {
        // Start of code block
        inCodeBlock = true;
        codeLanguage = line.trim().replace(/^```/, "").trim();
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Horizontal Rule
    if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<hr key={`hr-${i}`} className="my-2.5 border-slate-700" />);
      continue;
    }

    // Callout / Alert Box (> [!NOTE] or > [!IMPORTANT])
    if (line.startsWith("> [!")) {
      const alertType = line.match(/> \[!([A-Z]+)\]/)?.[1] || "NOTE";
      elements.push(
        <div
          key={`alert-${i}`}
          className="my-2 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-[11px] flex items-start space-x-2"
        >
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span className="font-semibold text-indigo-300">{alertType}:</span>
        </div>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-1.5 pl-3 border-l-2 border-indigo-400 text-slate-300 italic text-[11px]"
        >
          {renderInlineFormatting(line.replace(/^>\s*/, ""))}
        </blockquote>
      );
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4
          key={`h3-${i}`}
          className="text-xs font-bold text-indigo-300 mt-3 mb-1 tracking-wide flex items-center space-x-1.5"
        >
          <span>{renderInlineFormatting(line.replace(/^###\s+/, ""))}</span>
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3
          key={`h2-${i}`}
          className="text-sm font-bold text-white mt-3.5 mb-1.5 border-b border-slate-700 pb-1"
        >
          {renderInlineFormatting(line.replace(/^##\s+/, ""))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2
          key={`h1-${i}`}
          className="text-base font-extrabold text-white mt-4 mb-2"
        >
          {renderInlineFormatting(line.replace(/^#\s+/, ""))}
        </h2>
      );
      continue;
    }

    // Unordered list item (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const indent = line.search(/\S/);
      const cleanLine = line.replace(/^\s*[-*]\s+/, "");
      elements.push(
        <div
          key={`li-${i}`}
          className="flex items-start space-x-2 my-1"
          style={{ marginLeft: `${indent * 8}px` }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
          <span className="flex-1 leading-relaxed">
            {renderInlineFormatting(cleanLine)}
          </span>
        </div>
      );
      continue;
    }

    // Numbered list item (1. )
    const numMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const cleanLine = numMatch[2];
      elements.push(
        <div key={`num-${i}`} className="flex items-start space-x-2 my-1">
          <span className="font-mono text-indigo-400 font-bold shrink-0 text-[10px] mt-0.5">
            {num}.
          </span>
          <span className="flex-1 leading-relaxed">
            {renderInlineFormatting(cleanLine)}
          </span>
        </div>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      elements.push(<div key={`blank-${i}`} className="h-1.5" />);
      continue;
    }

    // Standard paragraph line
    elements.push(
      <p key={`p-${i}`} className="leading-relaxed my-0.5">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  // Handle open code block still streaming
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <div
        key="streaming-code"
        className="my-2.5 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 font-mono text-[11px]"
      >
        <div className="px-3 py-1 bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px]">
          <span className="uppercase font-semibold tracking-wider">
            {codeLanguage || "code"} (streaming...)
          </span>
        </div>
        <pre className="p-3 overflow-x-auto text-emerald-300/90 whitespace-pre leading-relaxed">
          <code>{codeBuffer.join("\n")}</code>
        </pre>
      </div>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

/**
 * Format inline markdown: `code`, **bold**, *italic*
 */
function renderInlineFormatting(text: string): React.ReactNode {
  // Regex to split by inline code `...`, bold **...**, italic *...*
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-900 border border-slate-700/80 font-mono text-[10px] text-amber-300 font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
