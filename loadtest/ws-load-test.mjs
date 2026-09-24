// Day 34 - WebSocket load test: ramps up concurrent "rooms" (2 connections each, like a real
// interview) until something breaks, and reports the last stage that held up cleanly.
//
// Connects directly to the raw WebSocket transport SockJS exposes at /ws/websocket, skipping
// SockJS's HTTP-polling framing - what the browser uses through sockjs-client, but for a load
// generator the raw transport is lighter and is a real code path your server already serves.
//
// Usage:
//   cd loadtest && npm install
//   node ws-load-test.mjs [--start 10] [--step 10] [--stageMs 8000] [--maxRooms 500] [--backend localhost:8080]
//
// Each "room" = 2 STOMP connections (interviewer + candidate), each subscribing to presence
// and run topics and sending a small EDIT event every 2-4s - steady light traffic, not a
// stress test of the Docker sandbox (Run is deliberately not exercised here; see the note
// at the end of the report for why).
import { Client } from "@stomp/stompjs";
import WebSocket from "ws";

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? fallback : process.argv[i + 1];
}

const START_ROOMS = Number(arg("start", 10));
const STEP_ROOMS = Number(arg("step", 10));
const STAGE_MS = Number(arg("stageMs", 8000));
const MAX_ROOMS = Number(arg("maxRooms", 500));
const BACKEND = arg("backend", "localhost:8080");
const WS_URL = `ws://${BACKEND}/ws/websocket`;

// A stage is judged "broken" past either threshold - whichever trips first ends the ramp
const MAX_FAILURE_RATE = 0.05;   // >5% of connection attempts failing in a stage
const MAX_P95_CONNECT_MS = 3000; // p95 time-to-CONNECTED frame across the stage

let allClients = [];      // { client, room, role, connectedAt }
let stopRequested = false;
const stageResults = [];

function b64(n) {
    return Buffer.from("x".repeat(n)).toString("base64");
}

function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return sorted[idx];
}

/** One simulated participant: connects, joins presence, sends periodic EDIT events until stopped. */
function spawnParticipant(roomCode, userId, stats) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        let settled = false;
        let editTimer = null;

        const client = new Client({
            webSocketFactory: () => new WebSocket(WS_URL),
            reconnectDelay: 0,               // a real reconnect would hide failures from this test
            connectionTimeout: 5000,
            onConnect: () => {
                const connectMs = Date.now() - t0;
                stats.connectTimes.push(connectMs);
                stats.connected++;

                client.publish({
                    destination: "/app/presence/join",
                    body: JSON.stringify({ roomCode, userId }),
                });
                client.subscribe(`/topic/presence/${roomCode}`, () => {});
                client.subscribe(`/topic/run/${roomCode}`, () => {});

                const sendEdit = () => {
                    if (!client.connected) return;
                    try {
                        client.publish({
                            destination: `/app/events/${roomCode}/edit`,
                            body: JSON.stringify({ userId, update: b64(40) }),
                        });
                    } catch { /* connection may have just dropped; next tick will notice */ }
                    editTimer = setTimeout(sendEdit, 2000 + Math.random() * 2000);
                };
                editTimer = setTimeout(sendEdit, 500 + Math.random() * 1000);

                if (!settled) { settled = true; resolve(true); }
            },
            onWebSocketClose: () => {
                stats.disconnected++;
                if (!settled) { settled = true; stats.failed++; resolve(false); }
            },
            onStompError: (frame) => {
                stats.errors.push(frame.headers["message"] ?? "STOMP error");
                if (!settled) { settled = true; stats.failed++; resolve(false); }
            },
            onWebSocketError: (err) => {
                stats.errors.push(String(err?.message ?? err));
                if (!settled) { settled = true; stats.failed++; resolve(false); }
            },
        });

        client.activate();
        allClients.push({ client, roomCode, userId, stop: () => { if (editTimer) clearTimeout(editTimer); } });

        // Attempts stuck past the STOMP timeout still count as a failure, so a slow stage
        // doesn't just hang forever
        setTimeout(() => {
            if (!settled) { settled = true; stats.failed++; resolve(false); }
        }, 6000);
    });
}

async function runStage(roomCount, cumulativeRooms) {
    const stats = { connected: 0, failed: 0, disconnected: 0, connectTimes: [], errors: [] };
    console.log(`\nStage: ${roomCount} new rooms (${roomCount * 2} connections), ${cumulativeRooms} rooms total so far...`);

    const attempts = [];
    for (let i = 0; i < roomCount; i++) {
        const roomCode = `loadtest-${cumulativeRooms + i}`;
        attempts.push(spawnParticipant(roomCode, "interviewer", stats));
        attempts.push(spawnParticipant(roomCode, "candidate", stats));
        // small stagger so we're not opening hundreds of sockets in the same millisecond,
        // which would measure connection-burst behavior rather than sustained ramp behavior
        await new Promise((r) => setTimeout(r, 15));
    }
    await Promise.all(attempts);

    // let the new connections run their steady-state edit traffic for the rest of the stage window
    await new Promise((r) => setTimeout(r, Math.max(0, STAGE_MS - roomCount * 15)));

    const sorted = [...stats.connectTimes].sort((a, b) => a - b);
    const attempted = roomCount * 2;
    const failureRate = stats.failed / attempted;
    const p50 = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);

    const result = { roomCount, cumulativeRooms: cumulativeRooms + roomCount, attempted, ...stats, p50, p95, failureRate };
    stageResults.push(result);

    console.log(
        `  connected=${stats.connected}/${attempted}  failed=${stats.failed}  ` +
        `disconnectedSinceConnect=${stats.disconnected}  connectMs p50=${p50} p95=${p95}`
    );
    if (stats.errors.length) {
        const sample = [...new Set(stats.errors)].slice(0, 3);
        console.log(`  sample errors: ${sample.join(" | ")}`);
    }

    return result;
}

function printReport(brokeAt) {
    console.log("\n=== Load test report ===");
    console.log(`Backend: ${BACKEND}   Total rooms opened: ${allClients.length / 2}   Total connections: ${allClients.length}`);
    console.table(stageResults.map((r) => ({
        rooms: r.cumulativeRooms,
        connections: r.cumulativeRooms * 2,
        "connected (stage)": r.connected,
        "failed (stage)": r.failed,
        "fail rate": `${(r.failureRate * 100).toFixed(1)}%`,
        "p50 ms": r.p50,
        "p95 ms": r.p95,
    })));

    if (brokeAt) {
        const lastGood = stageResults[stageResults.indexOf(brokeAt) - 1];
        console.log(
            `\nBreaking point: things held up through ~${lastGood ? lastGood.cumulativeRooms : 0} rooms ` +
            `(${lastGood ? lastGood.cumulativeRooms * 2 : 0} connections), and degraded at ${brokeAt.cumulativeRooms} rooms ` +
            `(fail rate ${(brokeAt.failureRate * 100).toFixed(1)}%, p95 connect ${brokeAt.p95}ms).`
        );
    } else {
        console.log(`\nNo breaking point hit up to ${MAX_ROOMS} rooms (${MAX_ROOMS * 2} connections) - raise --maxRooms to push further.`);
    }

    console.log(
        "\nNote: this only exercises WebSocket connections + presence + light edit traffic, " +
        "not the Docker sandbox - Run wasn't triggered here, since RunSlotService already caps " +
        "concurrent runs at 4 fleet-wide (Day 32), so sandbox capacity isn't really a WebSocket " +
        "question. If you want that number too, run the RunCoordinator/RunSlotService path " +
        "separately with a small script that just floods /app/run/{room}."
    );
}

async function shutdown() {
    console.log(`\nClosing ${allClients.length} connections...`);
    for (const c of allClients) {
        c.stop();
        try { c.client.deactivate(); } catch { /* already closed */ }
    }
    await new Promise((r) => setTimeout(r, 1000));
}

process.on("SIGINT", async () => {
    console.log("\nInterrupted - shutting down and printing what we have so far...");
    stopRequested = true;
});

async function main() {
    console.log(`Load test against ${WS_URL}`);
    console.log(`Ramp: start=${START_ROOMS} rooms, +${STEP_ROOMS} rooms every ${STAGE_MS}ms, cap=${MAX_ROOMS} rooms`);
    console.log(`Stops when a stage's connection failure rate > ${MAX_FAILURE_RATE * 100}% or p95 connect time > ${MAX_P95_CONNECT_MS}ms`);

    let cumulative = 0;
    let roomCount = START_ROOMS;
    let brokeAt = null;

    while (cumulative < MAX_ROOMS && !stopRequested) {
        const stage = await runStage(roomCount, cumulative);
        cumulative = stage.cumulativeRooms;

        if (stage.failureRate > MAX_FAILURE_RATE || stage.p95 > MAX_P95_CONNECT_MS) {
            brokeAt = stage;
            break;
        }
        roomCount = STEP_ROOMS;
    }

    await shutdown();
    printReport(brokeAt);
    process.exit(0);
}

main();
