"""
FastAPI Edge Bridge Gateway for UPI Offline Mesh
Simulates edge BLE collector nodes (e.g. IoT gateways, turnstiles, merchant POS)
forwarding encrypted mesh packets to the Spring Boot settlement backend.
"""

import os
import time
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")

app = FastAPI(
    title="UPI Offline Mesh — Edge Gateway",
    description="Edge bridge gateway service simulating BLE packet receivers and forwarding to the Spring Boot core settlement engine.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MeshPacket(BaseModel):
    packetId: str = Field(..., description="UUID of the packet")
    ttl: int = Field(5, description="Time to live / hop count limit")
    createdAt: int = Field(..., description="Timestamp in epoch millis")
    ciphertext: str = Field(..., description="Base64 hybrid encrypted ciphertext")


class EdgeIngestResponse(BaseModel):
    gatewayId: str
    edgeTimestamp: float
    backendStatus: int
    result: Dict[str, Any]


class DuplicateStormRequest(BaseModel):
    packet: MeshPacket
    bridgeCount: int = Field(3, ge=1, le=10, description="Number of concurrent edge nodes firing simultaneously")


@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "upi-edge-gateway",
        "backendUrl": BACKEND_URL,
        "timestamp": time.time(),
    }


@app.get("/info")
async def gateway_info():
    backend_status = "UNKNOWN"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{BACKEND_URL}/api/server-key")
            if resp.status_code == 200:
                backend_status = "CONNECTED"
            else:
                backend_status = f"ERROR_{resp.status_code}"
    except Exception as e:
        backend_status = f"UNREACHABLE: {str(e)}"

    return {
        "gatewayMode": "BLE_BRIDGE_COLLECTOR",
        "backendTarget": BACKEND_URL,
        "backendStatus": backend_status,
        "supportedAlgorithms": ["RSA-2048-OAEP", "AES-256-GCM"],
    }


@app.post("/api/edge/ingest", response_model=EdgeIngestResponse)
async def ingest_packet(
    packet: MeshPacket,
    x_bridge_node_id: str = Header("edge-gateway-pos-1", alias="X-Bridge-Node-Id"),
    x_hop_count: int = Header(3, alias="X-Hop-Count"),
):
    """
    Receives an encrypted mesh packet over Bluetooth/Wi-Fi Direct simulation
    and immediately uploads to the central Spring Boot settlement backend.
    """
    url = f"{BACKEND_URL}/api/bridge/ingest"
    headers = {
        "Content-Type": "application/json",
        "X-Bridge-Node-Id": x_bridge_node_id,
        "X-Hop-Count": str(x_hop_count),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=packet.model_dump(), headers=headers)
            return EdgeIngestResponse(
                gatewayId=x_bridge_node_id,
                edgeTimestamp=time.time(),
                backendStatus=resp.status_code,
                result=resp.json(),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to communicate with settlement backend at {BACKEND_URL}: {str(exc)}",
        )


@app.post("/api/edge/duplicate-storm-sim")
async def simulate_duplicate_storm(request: DuplicateStormRequest):
    """
    Simulates multiple edge gateways receiving the identical packet simultaneously
    and uploading concurrently to test and verify backend atomic idempotency.
    """
    url = f"{BACKEND_URL}/api/bridge/ingest"

    async def single_upload(node_id: str):
        headers = {
            "Content-Type": "application/json",
            "X-Bridge-Node-Id": node_id,
            "X-Hop-Count": "3",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=request.packet.model_dump(), headers=headers)
            return {
                "nodeId": node_id,
                "status": resp.status_code,
                "response": resp.json(),
            }

    tasks = [
        single_upload(f"edge-scanner-{i+1}")
        for i in range(request.bridgeCount)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    formatted_results = []
    for r in results:
        if isinstance(r, Exception):
            formatted_results.append({"error": str(r)})
        else:
            formatted_results.append(r)

    return {
        "concurrentUploadsFired": request.bridgeCount,
        "results": formatted_results,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
