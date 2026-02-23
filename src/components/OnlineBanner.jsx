/**
 * OnlineBanner.jsx
 * src/components/OnlineBanner.jsx
 *
 * Slim status strip: offline warning | reconnecting flash | nothing when online.
 * Uses navigator.onLine + window events — no Dexie, no Firebase.
 */

import { useEffect, useState } from "react";
import { BS, font } from "../constants/Brand";

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export default function OnlineBanner({ onReconnect }) {
  const isOnline = useOnlineStatus();
  const [showSync,   setShowSync]   = useState(false);
  const [prevOnline, setPrevOnline] = useState(isOnline);

  useEffect(() => {
    if (!prevOnline && isOnline) {
      setShowSync(true);
      onReconnect?.();
      const t = setTimeout(() => setShowSync(false), 3000);
      return () => clearTimeout(t);
    }
    setPrevOnline(isOnline);
  }, [isOnline]); // eslint-disable-line

  const base = {
    width: "100%", display: "flex", alignItems: "center",
    justifyContent: "center", gap: "8px",
    padding: "7px 16px", fontSize: "12px",
    fontWeight: 500, fontFamily: font.base,
    letterSpacing: "0.01em",
  };

  if (!isOnline) return (
    <div style={{ ...base, background: "#FFF8E7", color: "#92400E", borderBottom: "1px solid #FCD34D" }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: BS.accent, flexShrink: 0 }} />
      Offline — progress saved locally, will sync when reconnected
    </div>
  );

  if (showSync) return (
    <div style={{ ...base, background: BS.successLight, color: BS.solveText, borderBottom: `1px solid ${BS.solveBorder}` }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: BS.success, flexShrink: 0, animation: "pulse 1s infinite" }} />
      Back online — syncing your activity…
    </div>
  );

  return null;
}