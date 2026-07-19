"use client";

import PusherClient from "pusher-js";
import { useEffect, useRef } from "react";

let pusherInstance: PusherClient | null = null;

function getPusherClient(): PusherClient | null {
  if (pusherInstance) return pusherInstance;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) return null;

  pusherInstance = new PusherClient(key, { cluster });
  return pusherInstance;
}

export function usePusherDisponivel(): boolean {
  return !!(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
}

// Hook para escutar eventos de uma sessão
export function useSessaoRealtime(
  sessaoId: string,
  handlers: Record<string, (dados: Record<string, unknown>) => void>
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return; // sem Pusher → componente usa polling como fallback

    const canal = pusher.subscribe(`sessao-${sessaoId}`);

    const bindings: Array<{ evento: string }> = [];
    for (const evento of Object.keys(handlersRef.current)) {
      canal.bind(evento, (dados: Record<string, unknown>) => {
        handlersRef.current[evento]?.(dados);
      });
      bindings.push({ evento });
    }

    return () => {
      for (const { evento } of bindings) {
        canal.unbind(evento);
      }
      pusher.unsubscribe(`sessao-${sessaoId}`);
    };
  }, [sessaoId]);
}
