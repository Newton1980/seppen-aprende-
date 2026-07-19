import Pusher from "pusher";

let pusherInstance: Pusher | null = null;

export function getPusher(): Pusher | null {
  if (pusherInstance) return pusherInstance;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) return null;

  pusherInstance = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return pusherInstance;
}

// Dispara evento para todos os participantes de uma sessão
export async function emitirEvento(sessaoId: string, evento: string, dados: Record<string, unknown>) {
  const pusher = getPusher();
  if (!pusher) return; // sem Pusher configurado → clientes usam polling
  await pusher.trigger(`sessao-${sessaoId}`, evento, dados);
}
