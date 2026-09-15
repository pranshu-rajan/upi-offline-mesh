import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const SYSTEM_PROMPT = `You are the official AI Technical Specialist & Cryptographic Protocol Architect for the "UPI Offline Mesh" project.
Your purpose is to explain, diagnose, and answer user questions regarding offline UPI payments, store-and-forward mesh networking, cryptography, security defenses, and system architecture.

### ARCHITECTURE SPECIFICATIONS TO GROUND YOUR ANSWERS:
1. **Core Problem**: Traditional UPI requires continuous cellular/internet connectivity. In remote areas, basements, network congestion, or outages, digital transactions fail.
2. **Store-and-Forward Gossip Protocol**:
   - Payer generates an encrypted payment packet on their offline mobile device.
   - Devices communicate over short-range peer-to-peer wireless (Bluetooth Low Energy / BLE, Wi-Fi Direct).
   - Packets hop opportunistically device-to-device through stranger nodes without requiring any node to have internet.
   - Once ANY device ("Bridge Node") connects to cellular data or Wi-Fi, it flushes accumulated packets to the central Core Banking Engine.
3. **End-to-End Cryptography**:
   - **RSA-2048 OAEP** (with SHA-256 digest & MGF1 padding) is used to encrypt an ephemeral AES-256 session key using the Central Bank/Settlement Server's public key.
   - **AES-256-GCM** (Galois/Counter Mode with 128-bit authentication tag and 96-bit random IV/nonce) encrypts the payment details (sender VPA, receiver VPA, amount, encrypted PIN, timestamp).
   - **Zero-Knowledge to Relays**: Intermediate mesh nodes act purely as "blind mules". They cannot read balances, see payment amounts, or tamper with data.
4. **Idempotency & Replay Attack Defense**:
   - Every packet contains a unique cryptographic \`packetId\` (UUIDv4) and a SHA-256 idempotency hash.
   - The Spring Boot Core Engine maintains a high-speed idempotency cache with an 86,400-second (24h) TTL window.
   - Any replayed or re-transmitted packet is recognized and discarded, guaranteeing exactly-once settlement with zero double-spending.
5. **Hop Count & Packet TTL**:
   - Packets carry a Time-To-Live (default 5 hops).
   - Each peer hop decrements TTL. If TTL reaches 0 before reaching an internet bridge, it is purged to prevent perpetual mesh congestion.
6. **Security Attack Studio**:
   - Replay Attack: Intercepting and re-injecting a valid packet (thwarted by the idempotency cache).
   - Tamper Attack: Flipping bits in ciphertext (thwarted by AES-GCM authentication tag verification failure).
   - Balance exhaustion & Optimistic Concurrency: Handled via bank ledger versioning.
7. **Technology Stack**:
   - Core Settlement Engine: Spring Boot 3 (Java 17, Maven, JPA/H2, Cryptographic providers)
   - Edge Gateway: FastAPI (Python 3.11, Uvicorn)
   - Dashboard & Simulator: Next.js 16 (React 19, TypeScript, Tailwind CSS, Lucide icons, Canvas 2D topology)

### RESPONSE GUIDELINES:
- Output formatted, structured markdown line-by-line.
- Format tables using standard Markdown tables (| Col 1 | Col 2 |).
- Provide complete, thorough explanations, pacing the response so that it concludes cleanly and never cuts off mid-sentence.
- Use clean bullet points, step-by-step numbered lists, bold key terms, and code blocks with syntax identifiers.
- Keep explanations crisp, authoritative, technically accurate, and focused on the UPI Offline Mesh architecture.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. 'messages' array is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    const rawModel = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";

    // Build ordered list of candidate models supported on Groq accounts
    const candidateModels = [
      rawModel,
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "groq/compound-mini",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    // If API key is missing or set to placeholder, stream a helpful setup guide with an offline technical answer
    if (!apiKey || apiKey === "your_groq_api_key_here") {
      const lastUserMessage = messages[messages.length - 1]?.content || "";
      return createFallbackStreamingResponse(lastUserMessage);
    }

    // Initialize Groq client
    const groq = new Groq({ apiKey });

    // Stream completions from Groq with resilient multi-model fallback
    let groqStream = null;
    let lastError = null;

    for (const modelToTry of candidateModels) {
      try {
        groqStream = await groq.chat.completions.create({
          model: modelToTry,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            })),
          ],
          stream: true,
          temperature: 0.3,
          max_tokens: 3500,
        });
        break; // Successfully started stream
      } catch (err: unknown) {
        lastError = err;
        console.warn(`Groq model '${modelToTry}' unavailable, trying next candidate...`);
      }
    }

    if (!groqStream) {
      throw lastError || new Error("All candidate Groq models failed to respond.");
    }

    // Create ReadableStream that pumps chunks line-by-line to the client
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of groqStream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (streamError) {
          console.error("Groq stream error:", streamError);
          const errorMsg = `\n\n⚠️ **Streaming Error**: ${
            streamError instanceof Error ? streamError.message : "Unknown error occurred while streaming."
          }`;
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("API /api/chat error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Fallback streaming response when GROQ_API_KEY is not yet configured.
 * Demonstrates real-time line-by-line streaming while guiding the user on where to paste their key!
 */
function createFallbackStreamingResponse(question: string) {
  const encoder = new TextEncoder();
  const lowerQ = question.toLowerCase();

  let answerContent = "";
  if (lowerQ.includes("crypt") || lowerQ.includes("rsa") || lowerQ.includes("aes") || lowerQ.includes("encrypt")) {
    answerContent = `### 🔐 Cryptographic Protocol in Offline UPI

Offline transactions use **Hybrid Encryption** ensuring end-to-end secrecy:

1. **RSA-2048 OAEP (Key Encapsulation)**:
   - The payer's device obtains the central settlement bank's RSA-2048 public key.
   - An ephemeral **AES-256 symmetric session key** is randomly generated on the device and encrypted via RSA-OAEP with SHA-256 and MGF1 padding.
2. **AES-256-GCM (Authenticated Payload Encryption)**:
   - The payment payload (Sender VPA, Receiver VPA, Amount, PIN, Timestamp, Nonce) is encrypted using AES-256-GCM.
   - GCM produces a **128-bit authentication tag** alongside ciphertext.
3. **Zero-Knowledge Blind Relays**:
   - Intermediate stranger devices (mesh nodes) merely relay the ciphertext block.
   - They cannot read the amount, view the sender/receiver, or forge the PIN. Any bit tampering immediately causes an authentication tag mismatch at the server.`;
  } else if (lowerQ.includes("replay") || lowerQ.includes("double") || lowerQ.includes("spend") || lowerQ.includes("attack")) {
    answerContent = `### 🛡️ Double-Spending & Replay Attack Defense

The UPI Offline Mesh prevents duplicate settlements without requiring online checks at the moment of payment:

1. **Cryptographic Idempotency Hash**:
   - Each packet contains a unique \`packetId\` (UUIDv4) and a SHA-256 digest of the encrypted payload and nonce.
2. **Core Settlement Cache**:
   - The Spring Boot engine maintains an in-memory & database idempotency cache with an 86,400-second (24-hour) TTL window.
   - When a bridge node flushes packets, the engine checks: \`idempotencyCache.contains(packetId)\`.
3. **Outcome of a Replay**:
   - First arrival: Settles transaction, credits receiver, debits sender, records packet hash in cache.
   - Subsequent arrivals: Detected as \`DUPLICATE_PACKET_DETECTED\`, logged as a discarded replay, and rejected without double-debiting.`;
  } else if (lowerQ.includes("gossip") || lowerQ.includes("mesh") || lowerQ.includes("hop") || lowerQ.includes("store")) {
    answerContent = `### 🔄 Store-and-Forward Gossip Mesh Protocol

How packets travel from an offline device to the banking switch:

1. **Local Injection**:
   - Alice creates a payment on \`phone-alice\` while completely offline.
   - The encrypted payload is buffered in Alice's local SQLite/in-memory queue.
2. **BLE / Wi-Fi Direct Peer Discovery**:
   - Nearby devices broadcast short beacons.
   - In each gossip cycle, peers exchange packet inventories and replicate unexpired packets.
3. **Hop Count & TTL Decrement**:
   - Each transaction packet has a Time-To-Live (default: **5 hops**).
   - Each forwarding device decrements TTL by 1. Stale packets reaching TTL = 0 are purged to prevent congestion.
4. **Bridge Node Flush**:
   - As soon as any participating phone (\`phone-bridge\`) detects cellular or Wi-Fi internet, it flushes all cached packets via HTTP POST to the central settlement gateway.`;
  } else {
    answerContent = `### 🌐 Offline UPI Mesh Architecture Overview

The system enables secure digital payments in zero-connectivity environments:

- **Store-and-Forward Gossip**: Opportunistic packet propagation via Bluetooth Low Energy (BLE).
- **Hybrid Cryptography**: RSA-2048 OAEP + AES-256-GCM ensures privacy across intermediate relay devices.
- **Settlement Idempotency**: SHA-256 packet IDs and 24-hour cache prevent replay attacks and double-spending.
- **Interactive Simulator**:
  - **Inject Payment**: Generate an encrypted payment packet from any offline device.
  - **BLE Gossip**: Simulate wireless hop replication across peer phones.
  - **Flush to Gateway**: Deliver accumulated packets to the core banking switch.
  - **Attack Studio**: Test real-time defenses against Replays, Tampering, and TTL exhaustion.`;
  }

    const fullText = answerContent;
    const words = fullText.split(" ");

  const readable = new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(encoder.encode(word + " "));
        await new Promise((r) => setTimeout(r, 22)); // smooth token streaming delay
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
