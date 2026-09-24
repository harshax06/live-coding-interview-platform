import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
// @ts-ignore
import SockJS from 'sockjs-client';

// Day 33 test-only escape hatch: open a tab with ?backend=8081 to point that tab at a second
// local backend instance, so a two-instance cross-broadcast test doesn't need a load balancer
// yet (that's Week 9). No query param = 8080, today's normal single-instance behavior.
function backendPort(): string {
    return new URLSearchParams(window.location.search).get('backend') ?? '8080';
}

export function useStompClient() {
    const [client, setClient] = useState<Client | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const port = backendPort();
        const stompClient = new Client({
            webSocketFactory: () => new SockJS(`http://localhost:${port}/ws`),

            reconnectDelay: 5000,

            onConnect: () => {
                console.log(`Connected! (backend :${port})`);
                setConnected(true);
            },

            onDisconnect: () => {
                setConnected(false);
            },

            onStompError: (frame) => {
                console.error(
                    'STOMP error:',
                    frame.headers['message'],
                    frame.body
                );
            },

            onWebSocketError: (error) => {
                console.error('WebSocket error:', error);
            },
        });

        setClient(stompClient);
        stompClient.activate();

        return () => {
            stompClient.deactivate();
            setConnected(false);
        };
    }, []);

    return { client, connected };
}