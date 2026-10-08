"use client";

// Que movil y navegador es, y si ya tiene los avisos (D99, 3.1). Solo en el navegador.

export type Caso = "iphone-safari" | "iphone-otro" | "puede" | "activados" | "denegados" | "no-soportado";

export function datosDispositivo() {
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const otroNavegador = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|YaBrowser|DuckDuckGo/.test(ua);
  const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const android = /Android/.test(ua);
  const navegador = `${iphone ? "iPhone" : android ? "Android" : "Ordenador"} · ${/CriOS|Chrome/.test(ua) && !/Edg/.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Edg/.test(ua) ? "Edge" : /Safari/.test(ua) ? "Safari" : "otro"}${instalada ? " · instalada" : ""}`;
  return { iphone, otroNavegador, instalada, soporta, android, navegador };
}

export async function registro() {
  if (!("serviceWorker" in navigator)) return null;
  const actual = await navigator.serviceWorker.getRegistration("/");
  if (actual) return actual;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    const reg = await navigator.serviceWorker.getRegistration("/");
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch { return null; }
}

export async function casoActual(): Promise<Caso> {
  const d = datosDispositivo();
  if (d.iphone && !d.instalada) return d.otroNavegador ? "iphone-otro" : "iphone-safari";
  if (!d.soporta) return "no-soportado";
  if (Notification.permission === "denied") return "denegados";
  const s = await suscripcionActual();
  return s && Notification.permission === "granted" ? "activados" : "puede";
}

const aBytes = (b64: string) => {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Pide permiso y suscribe este movil. Devuelve los datos para guardarla en la base. */
export async function suscribir(clavePublica: string) {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return { ok: false as const, permiso };
  const reg = await registro();
  if (!reg) return { ok: false as const, permiso };
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clavePublica) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  return { ok: true as const, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
}
