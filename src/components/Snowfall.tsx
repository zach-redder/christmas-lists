"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "rc-snow";
const FLAKES = 60;

type Flake = { x: number; y: number; r: number; speed: number; drift: number; phase: number };

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function Snowfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with localStorage after hydration
    setEnabled(readPreference());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const running = enabled && !reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!running || !canvas || !ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const flakes: Flake[] = Array.from({ length: FLAKES }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.2 + Math.random() * 2.6,
      speed: 0.25 + Math.random() * 0.6,
      drift: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    let raf = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        f.y += f.speed;
        f.x += Math.sin(frame / 90 + f.phase) * f.drift * 0.4;
        if (f.y > height + 5) {
          f.y = -5;
          f.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        // white flake with a faint cool rim so it shows on cream paper as well as red
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.strokeStyle = "rgba(90,110,125,0.28)";
        ctx.lineWidth = 0.8;
        ctx.fill();
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      ctx.clearRect(0, 0, width, height);
    };
  }, [running]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* storage unavailable (private mode): toggle still works for this visit */
    }
  };

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full" aria-hidden="true" />
      {!reducedMotion && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          aria-label={enabled ? "Turn off falling snow" : "Turn on falling snow"}
          title={enabled ? "Turn off falling snow" : "Turn on falling snow"}
          className={`fixed right-3 bottom-24 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-parchment bg-snow/90 text-xl shadow md:bottom-4 ${
            enabled ? "text-pine" : "text-ink-soft/50 line-through"
          }`}
        >
          <span aria-hidden="true">❄</span>
        </button>
      )}
    </>
  );
}
