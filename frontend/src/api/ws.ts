import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast, type ToastTone } from "../components/Toast";
import type { AlertSeverity, WsMessage } from "./types";

export type LiveStatus = "connecting" | "live" | "reconnecting";

const THROTTLE_MS = 1000;
const MAX_BACKOFF_MS = 15000;

const SEVERITY_TONE: Record<AlertSeverity, ToastTone> = { info: "info", warning: "warning", critical: "critical" };

function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

function parse(data: unknown): WsMessage | null {
  if (typeof data !== "string") return null;
  try {
    const msg: unknown = JSON.parse(data);
    if (msg && typeof msg === "object" && "type" in msg) return msg as WsMessage;
  } catch {
    // ignore malformed frames
  }
  return null;
}

/** Connects to /ws, refreshes queries on state changes and toasts new alerts. */
export function useLiveUpdates(): LiveStatus {
  const qc = useQueryClient();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 0;
    let reconnectTimer: number | undefined;
    let throttleTimer: number | undefined;
    let lastInvalidate = 0;
    let closed = false;

    const flush = () => {
      lastInvalidate = Date.now();
      void qc.invalidateQueries();
    };

    const invalidate = () => {
      const wait = THROTTLE_MS - (Date.now() - lastInvalidate);
      if (wait <= 0) flush();
      else if (throttleTimer === undefined) {
        throttleTimer = window.setTimeout(() => {
          throttleTimer = undefined;
          flush();
        }, wait);
      }
    };

    const connect = () => {
      socket = new WebSocket(wsUrl());
      socket.onopen = () => {
        retry = 0;
        setStatus("live");
        invalidate();
      };
      socket.onmessage = (ev: MessageEvent) => {
        const msg = parse(ev.data);
        if (!msg) return;
        if (msg.type === "alert") {
          const a = msg.alert;
          toastRef.current.push({
            tone: SEVERITY_TONE[a.severity] ?? "info",
            title: a.title,
            message: a.message,
            href: a.worker_id ? `/workers/${a.worker_id}` : a.zone_id ? `/zones/${a.zone_id}` : "/alerts",
          });
        }
        invalidate();
      };
      socket.onclose = () => {
        if (closed) return;
        setStatus("reconnecting");
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retry) + Math.random() * 300;
        retry += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearTimeout(throttleTimer);
      socket?.close();
    };
  }, [qc]);

  return status;
}
