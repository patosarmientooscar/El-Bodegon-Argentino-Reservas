"use client";

import { AnimatePresence, motion } from "motion/react";

/** "Mesa para 3" con el número rodando hacia arriba (sube) o hacia abajo (baja). */
export function PartyCount({ count, direction, reduced }: { count: number; direction: 1 | -1; reduced: boolean }) {
  return (
    <>
      <p aria-hidden="true" className="rv-count">
        Mesa para{" "}
        <span className="rv-count-num">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.span
              key={count}
              custom={direction}
              variants={{
                enter: (d: number) => ({ y: d > 0 ? "75%" : "-75%", opacity: 0 }),
                center: { y: "0%", opacity: 1 },
                exit: (d: number) => ({ y: d > 0 ? "-75%" : "75%", opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 26 }}
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </span>
      </p>
      <p className="rv-sr" aria-live="polite" aria-atomic="true">
        Mesa para {count} {count === 1 ? "persona" : "personas"}
      </p>
    </>
  );
}
