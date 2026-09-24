"use client";

import { AnimatePresence, motion } from "motion/react";

/** "Mesa para 3" con el número rodando hacia arriba (sube) o hacia abajo (baja). */
export function PartyCount({ count, direction, reduced }: { count: number; direction: 1 | -1; reduced: boolean }) {
  return (
    <>
      <p
        aria-hidden="true"
        className="font-[family-name:var(--font-playfair)] text-[2.6rem] leading-none font-bold text-[#f3ead8]"
      >
        Mesa para{" "}
        <span className="relative inline-grid h-[1.15em] overflow-hidden align-bottom tabular-nums">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.span
              key={count}
              custom={direction}
              variants={{
                enter: (d: number) => ({ y: d > 0 ? "70%" : "-70%", opacity: 0 }),
                center: { y: "0%", opacity: 1 },
                exit: (d: number) => ({ y: d > 0 ? "-70%" : "70%", opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30 }}
              className="col-start-1 row-start-1 text-[#c8a24a]"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </span>
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Mesa para {count} {count === 1 ? "persona" : "personas"}
      </p>
    </>
  );
}
