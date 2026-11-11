import { useEffect, useRef, useState } from 'react';
import type { ServerDto } from '../../api/types.gen';

export interface Stats {
  cpuPercent: number;
  memoryBytes: number;
  memoryLimitBytes: number;
}

export interface Players {
  online: number;
  max: number;
  /** May be fewer than `online` (Minecraft sends at most 12 names). */
  names: string[];
}

/** Set while the agent waits to restart a crashed server (ADR 0010). */
export interface Restart {
  attempt: number;
  maxAttempts: number;
}

interface Status {
  status: ServerDto['status'];
  message: string | null;
  restart?: Restart | null;
}

type Event =
  | ({ type: 'snapshot'; output: string; stats: Stats | null; players: Players | null } & Status)
  | { type: 'output'; data: string }
  | ({ type: 'status' } & Status)
  | ({ type: 'stats' } & Stats)
  | ({ type: 'players' } & Players);

/**
 * Live console of one server over the gateway's WebSocket (`/api/v1/servers/<id>/console`).
 * Output goes straight to `onOutput` (the terminal), status and stats into React state.
 */
export function useServerConsole(serverId: string, onOutput: (data: string, reset: boolean) => void) {
  const [status, setStatus] = useState<Status | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [players, setPlayers] = useState<Players | null>(null);
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const output = useRef(onOutput);
  output.current = onOutput;

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${scheme}://${location.host}/api/v1/servers/${serverId}/console`);
      socket.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000); // reconnect, e.g. after a gateway restart
      };
      ws.onmessage = (e) => {
        const event = JSON.parse(e.data as string) as Event;
        switch (event.type) {
          case 'snapshot':
            output.current(event.output, true);
            setStatus({ status: event.status, message: event.message, restart: event.restart });
            setStats(event.stats);
            setPlayers(event.players ?? null);
            break;
          case 'output':
            output.current(event.data, false);
            break;
          case 'status':
            setStatus({ status: event.status, message: event.message, restart: event.restart });
            if (event.status !== 'running') {
              setStats(null);
              setPlayers(null);
            }
            break;
          case 'stats':
            setStats({ cpuPercent: event.cpuPercent, memoryBytes: event.memoryBytes, memoryLimitBytes: event.memoryLimitBytes });
            break;
          case 'players':
            setPlayers({ online: event.online, max: event.max, names: event.names });
            break;
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [serverId]);

  const send = (command: string) => socket.current?.send(JSON.stringify({ type: 'command', command }));

  return { status, stats, players, connected, send };
}
