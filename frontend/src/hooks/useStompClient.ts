import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
// @ts-ignore
import SockJS from 'sockjs-client';

export function useStompClient() {
    const [client, setClient] = useState<Client | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const stompClient = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8080/ws'),

            reconnectDelay: 5000,

            onConnect: () => {
                console.log('Connected!');
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