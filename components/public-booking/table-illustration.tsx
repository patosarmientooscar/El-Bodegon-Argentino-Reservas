"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimationControls, type Transition } from "motion/react";

/**
 * Mesa vista desde arriba que reacciona al número de comensales (1–4).
 * La mesa cambia de forma con un muelle suave; cada silla nueva cae con
 * escala 0→1 y rebote; al quitar una, se desliza hacia fuera y se desvanece.
 * `served` enciende la vela y las copas (pantalla de éxito).
 */

const CX = 160;
const CY = 112;
const CHAIR_OFFSET = 20; // distancia del borde de la mesa al centro de la silla
const PLATE_INSET = 22; // distancia del borde de la mesa al centro del plato
const STAGGER = 0.06;

type Seat = "bottom" | "top" | "left" | "right";
const SEAT_ORDER: Seat[] = ["bottom", "top", "left", "right"];

/** Rotación de la silla: el respaldo queda en el lado opuesto a la mesa. */
const SEAT_ROTATION: Record<Seat, number> = { bottom: 0, top: 180, left: 90, right: -90 };
const SEAT_OUTWARD: Record<Seat, { dx: number; dy: number }> = {
  bottom: { dx: 0, dy: 1 },
  top: { dx: 0, dy: -1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

interface TableShape {
  w: number;
  h: number;
  rx: number;
  /** desplazamiento horizontal de las sillas de arriba/abajo (equilibra la de 3) */
  shift: number;
}

const SHAPES: Record<number, TableShape> = {
  1: { w: 94, h: 94, rx: 47, shift: 0 }, // redonda pequeña
  2: { w: 92, h: 116, rx: 46, shift: 0 }, // se estira hacia la 2ª silla
  3: { w: 156, h: 92, rx: 14, shift: 16 }, // rectangular, silla lateral
  4: { w: 124, h: 118, rx: 14, shift: 0 }, // casi cuadrada, 4 lados
};

function clampSeats(count: number): number {
  return Math.min(Math.max(count, 1), 4);
}

function seatPosition(seat: Seat, shape: TableShape, offset: number): { x: number; y: number } {
  switch (seat) {
    case "bottom":
      return { x: CX + shape.shift, y: CY + shape.h / 2 + offset };
    case "top":
      return { x: CX + shape.shift, y: CY - shape.h / 2 - offset };
    case "left":
      return { x: CX - shape.w / 2 - offset, y: CY };
    case "right":
      return { x: CX + shape.w / 2 + offset, y: CY };
  }
}

const TABLE_SPRING: Transition = { type: "spring", stiffness: 210, damping: 20, mass: 0.9 };
const INSTANT: Transition = { duration: 0 };

function Chair() {
  return (
    <g>
      <rect x={-18} y={10} width={36} height={9} rx={4} fill="#2b1a0e" />
      <rect x={-17} y={-13} width={34} height={27} rx={8} fill="#4a2f1b" />
      <rect x={-13} y={-9} width={26} height={19} rx={6} fill="none" stroke="#6b4527" strokeWidth={1.2} opacity={0.7} />
    </g>
  );
}

function PlateSetting({ served, reduced }: { served: boolean; reduced: boolean }) {
  return (
    <g>
      <circle r={12} fill="#f3ead8" />
      <circle r={8} fill="none" stroke="#d8cbb0" strokeWidth={1.4} />
      <rect x={-18} y={-7} width={2.2} height={14} rx={1.1} fill="#b9ac93" />
      <rect x={16} y={-7} width={2.2} height={14} rx={1.1} fill="#b9ac93" />
      {/* copa */}
      <motion.circle
        cx={15}
        cy={-16}
        r={4.8}
        stroke="#c8a24a"
        strokeWidth={1.4}
        fill="#c8a24a"
        filter={served ? "url(#pb-glow)" : undefined}
        initial={false}
        animate={{ fillOpacity: served ? 0.9 : 0.08 }}
        transition={reduced ? INSTANT : { duration: 0.6, delay: 0.35 }}
      />
    </g>
  );
}

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
  const seatCount = clampSeats(count);
  const shape = SHAPES[seatCount];
  const seats = SEAT_ORDER.slice(0, seatCount);
  const controls = useAnimationControls();

  // En el primer render las sillas entran escalonadas (~60 ms); después,
  // cada silla nueva cae justo cuando la mesa empieza a estirarse.
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);
  const enterDelay = (index: number) => (reduced ? 0 : firstRender.current ? 0.15 + index * STAGGER : STAGGER);

  useEffect(() => {
    if (shakeSignal === 0 || reduced) return;
    void controls.start({
      x: [0, -9, 8, -6, 5, -2, 0],
      transition: { duration: 0.45, ease: "easeInOut" },
    });
  }, [shakeSignal, reduced, controls]);

  const tableTransition = reduced ? INSTANT : TABLE_SPRING;

  return (
    <svg viewBox="0 0 320 224" className="h-auto w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pb-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7a5232" />
          <stop offset="55%" stopColor="#5b3a22" />
          <stop offset="100%" stopColor="#3e2716" />
        </linearGradient>
        <radialGradient id="pb-candle-light">
          <stop offset="0%" stopColor="#e9c46a" stopOpacity={0.55} />
          <stop offset="45%" stopColor="#c8a24a" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#c8a24a" stopOpacity={0} />
        </radialGradient>
        <filter id="pb-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#000" floodOpacity="0.6" />
        </filter>
        <filter id="pb-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.g animate={controls}>
        {/* sillas (por debajo de la mesa) */}
        <AnimatePresence initial={!reduced}>
          {seats.map((seat, index) => {
            const p = seatPosition(seat, shape, CHAIR_OFFSET);
            const out = SEAT_OUTWARD[seat];
            const delay = enterDelay(index);
            return (
              <motion.g
                key={seat}
                initial={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
                animate={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
                exit={{
                  x: p.x + out.dx * 30,
                  y: p.y + out.dy * 30,
                  opacity: 0,
                  transition: reduced ? INSTANT : { duration: 0.3, ease: "easeIn" },
                }}
                transition={{
                  x: tableTransition,
                  y: tableTransition,
                  scale: reduced ? INSTANT : { type: "spring", stiffness: 560, damping: 14, delay },
                  opacity: reduced ? INSTANT : { duration: 0.15, delay },
                }}
              >
                <g transform={`rotate(${SEAT_ROTATION[seat]})`}>
                  <Chair />
                </g>
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* mesa */}
        <g filter="url(#pb-shadow)">
          <motion.rect
            fill="url(#pb-wood)"
            initial={false}
            animate={{ attrX: CX - shape.w / 2, attrY: CY - shape.h / 2, width: shape.w, height: shape.h, rx: shape.rx }}
            transition={tableTransition}
          />
        </g>
        <motion.rect
          fill="none"
          stroke="#f3ead8"
          strokeOpacity={0.09}
          strokeWidth={1.5}
          initial={false}
          animate={{
            attrX: CX - shape.w / 2 + 6,
            attrY: CY - shape.h / 2 + 6,
            width: shape.w - 12,
            height: shape.h - 12,
            rx: Math.max(shape.rx - 6, 6),
          }}
          transition={tableTransition}
        />

        {/* luz de la vela (solo con la mesa servida) */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={78}
          fill="url(#pb-candle-light)"
          initial={false}
          animate={{ opacity: served ? 1 : 0 }}
          transition={reduced ? INSTANT : { duration: 0.9 }}
        />

        {/* plato y copa por comensal: aparecen con su silla */}
        <AnimatePresence initial={!reduced}>
          {seats.map((seat, index) => {
            const p = seatPosition(seat, shape, -PLATE_INSET);
            const delay = enterDelay(index) + (reduced ? 0 : 0.08);
            return (
              <motion.g
                key={seat}
                initial={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
                animate={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
                exit={{ opacity: 0, scale: 0.6, transition: reduced ? INSTANT : { duration: 0.2 } }}
                transition={{
                  x: tableTransition,
                  y: tableTransition,
                  scale: reduced ? INSTANT : { type: "spring", stiffness: 500, damping: 18, delay },
                  opacity: reduced ? INSTANT : { duration: 0.15, delay },
                }}
              >
                <g transform={`rotate(${SEAT_ROTATION[seat]})`}>
                  <PlateSetting served={served} reduced={reduced} />
                </g>
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* vela */}
        <circle cx={CX} cy={CY} r={6} fill="#e8dcc2" />
        <circle cx={CX} cy={CY} r={2} fill="#3a2a1a" />
        <motion.g
          initial={false}
          animate={{ opacity: served ? 1 : 0, scale: served ? 1 : 0.4 }}
          transition={reduced ? INSTANT : { duration: 0.5, delay: 0.2 }}
        >
          <motion.ellipse
            cx={CX}
            cy={CY - 1}
            rx={3.6}
            ry={5.4}
            fill="#f5d37a"
            filter="url(#pb-glow)"
            animate={served && !reduced ? { scale: [1, 1.12, 0.94, 1.06, 1] } : { scale: 1 }}
            transition={served && !reduced ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : INSTANT}
          />
        </motion.g>
      </motion.g>
    </svg>
  );
}
