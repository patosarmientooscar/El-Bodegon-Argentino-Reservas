"use client";

import { useEffect, useRef } from "react";

import { MesaEngine } from "./mesa-engine";

/**
 * Mesa vista desde arriba con morphing (ver mesa-engine.ts). React solo
 * le pasa el estado; el motor anima el SVG directamente, fuera del render.
 */
export function TableIllustration({
  count,
  shakeSignal,
  served,
  reduced,
}: {
  count: number;
  /** Cada incremento dispara el "shake" (intento de pasar del máximo). */
  shakeSignal: number;
  served: boolean;
  reduced: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MesaEngine | null>(null);

  useEffect(() => {
    const engine = new MesaEngine(containerRef.current!, reduced);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // El motor se crea una vez; reduced/count/served se sincronizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setReduced(reduced);
  }, [reduced]);

  useEffect(() => {
    engineRef.current?.setCount(count);
  }, [count]);

  useEffect(() => {
    engineRef.current?.setServed(served);
  }, [served]);

  useEffect(() => {
    if (shakeSignal > 0) engineRef.current?.shake();
  }, [shakeSignal]);

  return <div ref={containerRef} className="rv-mesa" aria-hidden="true" />;
}
