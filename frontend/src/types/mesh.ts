export interface Device {
  deviceId: string;
  hasInternet: boolean;
  packetCount: number;
  packetIds: string[];
  battery?: number;
  role?: "Sender" | "Relay" | "Bridge" | "Receiver";
  x?: number;
  y?: number;
}

export interface Account {
  vpa: string;
  holderName: string;
  balance: number;
  version?: number;
  devicePublicKey?: string;
  lastSequenceNumber?: number;
  offlineLimit?: number;
}

export interface Transaction {
  id: number;
  senderVpa: string;
  receiverVpa: string;
  amount: number;
  status: string;
  bridgeNodeId: string;
  hopCount: number;
  settledAt: string;
}

export interface ServerKeyInfo {
  publicKey?: string;
  algorithm?: string;
  deviceSignatureScheme?: string;
  hybridScheme?: string;
}

export interface LogEntry {
  id: string;
  time: string;
  type: "info" | "success" | "warning" | "error" | "gossip" | "inject" | "attack";
  message: string;
}

export interface TopologyLink {
  source: string;
  target: string;
  distance: number;
  rssiDbm: number;
}

export interface DynamicTopology {
  nodes: Device[];
  links: TopologyLink[];
  totalNodes: number;
}

