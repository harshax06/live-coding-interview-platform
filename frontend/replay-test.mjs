// Day 24 - drives a replay over STOMP and prints what arrives, with timings.
// Put this file in the  frontend/  folder (it uses that folder's @stomp/stompjs and sockjs-client), then:
//   node replay-test.mjs <roomCode> [speed] [maxGapMs]
// Backend must be running and the room must have recorded events (check the session_events table).
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const [room, speedArg = "1", gapArg = "3000"] = process.argv.slice(2);
if (!room) {
  console.log("Usage: node replay-test.mjs <roomCode> [speed] [maxGapMs]");
  process.exit(1);
}

const replayId = "test-" + Date.now();
const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(2)}s]`;

let duration = 0;
let emitted = 0;
let instantCount = 0;
let duplicates = 0;
let outOfOrder = 0;
let seen = new Set();
let lastIndex = -1;
let finished = false;

const client = new Client({
  webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
  reconnectDelay: 0,
  onConnect: () => {
    client.subscribe(`/topic/replay/${replayId}`, (frame) => {
      const m = JSON.parse(frame.body);
      switch (m.kind) {
        case "STARTED":
          duration = m.durationMs;
          console.log(`${stamp()} STARTED  total=${m.total} timeline=${m.durationMs}ms`);
          schedulePlan();
          break;
        case "EVENT":
          if (seen.has(m.index)) duplicates++;
          seen.add(m.index);
          if (!m.instant) {
            if (m.index <= lastIndex) outOfOrder++;
            lastIndex = m.index;
            emitted++;
            console.log(`${stamp()} EVENT    #${m.index}/${m.total} ${m.type.padEnd(13)} ${m.userId}  offset=${m.playOffsetMs}ms`);
          } else {
            instantCount++;
          }
          break;
        case "RESET":
          seen = new Set();
          lastIndex = -1;
          console.log(`${stamp()} RESET    (client would clear its state)`);
          break;
        case "SEEKED":
          console.log(`${stamp()} SEEKED   position=${m.positionMs}ms  (${instantCount} events sent instantly)`);
          instantCount = 0;
          break;
        case "PAUSED":
          console.log(`${stamp()} PAUSED   position=${m.positionMs}ms`);
          break;
        case "FINISHED":
          finished = true;
          console.log(`${stamp()} FINISHED`);
          setTimeout(summary, 800);
          break;
        case "ERROR":
          console.log(`${stamp()} ERROR    ${m.message}`);
          process.exit(1);
      }
    });

    console.log(`${stamp()} start room=${room} speed=${speedArg} maxGapMs=${gapArg}`);
    client.publish({
      destination: `/app/replay/${replayId}/start`,
      body: JSON.stringify({ roomCode: room, speed: Number(speedArg), maxGapMs: Number(gapArg) }),
    });
  },
  onStompError: (f) => { console.log("STOMP error", f.headers.message); process.exit(1); },
});

// pause at 2s, resume at 3s, jump to the middle of the timeline at 5s
function schedulePlan() {
  const cmd = (name, body) => client.publish({ destination: `/app/replay/${replayId}/${name}`, body: JSON.stringify(body ?? {}) });
  setTimeout(() => { if (!finished) { console.log(`${stamp()} >> pause`); cmd("pause"); } }, 2000);
  setTimeout(() => { if (!finished) { console.log(`${stamp()} >> resume`); cmd("resume"); } }, 3000);
  setTimeout(() => { if (!finished) { console.log(`${stamp()} >> seek to ${Math.floor(duration / 2)}ms`); cmd("seek", { positionMs: Math.floor(duration / 2) }); } }, 5000);
}

function summary() {
  console.log(`\nemitted on the timer: ${emitted}, duplicate indexes within a segment: ${duplicates}, out-of-order: ${outOfOrder}`);
  console.log(duplicates === 0 && outOfOrder === 0 ? "RESULT: OK" : "RESULT: PROBLEM (see above)");
  client.deactivate().then(() => process.exit(duplicates === 0 && outOfOrder === 0 ? 0 : 1));
}

setTimeout(() => { console.log("timeout after 3 min"); process.exit(1); }, 180000);
client.activate();
