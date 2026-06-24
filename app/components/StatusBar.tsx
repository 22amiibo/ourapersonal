"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function StatusBar() {
  const [time, setTime] = useState("");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    const tick = () => {
      const d = new Date();
      const h = d.getHours() % 12 || 12;
      setTime(`${h}:${pad(d.getMinutes())}`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      aria-hidden
      className="relative z-20 flex w-full shrink-0 select-none items-end text-white"
      style={{ height: 59, paddingBottom: 8, paddingLeft: 20 }}
    >
      {!standalone && (
        <span className="text-[15px] font-semibold tabular-nums leading-none">{time}</span>
      )}
    </div>
  );
}
