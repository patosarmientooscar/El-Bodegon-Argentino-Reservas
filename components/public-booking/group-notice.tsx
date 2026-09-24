"use client";

import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, Phone } from "lucide-react";

import { FOCUS_RING, PRESSABLE, SERIF } from "./ui";

/** Aviso "¿Sois más de 4? Llámanos" al intentar pasar del máximo. */
export function GroupNotice({
  open,
  max,
  telHref,
  whatsappHref,
  reduced,
}: {
  open: boolean;
  max: number;
  telHref: string | null;
  whatsappHref: string | null;
  reduced: boolean;
}) {
  const linkClass = `flex h-12 items-center justify-center gap-2 rounded-xl text-[0.95rem] font-semibold ${PRESSABLE} ${FOCUS_RING}`;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="group-notice"
          initial={reduced ? false : { opacity: 0, height: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, height: "auto", y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0, height: 0, transition: { duration: 0 } } : { opacity: 0, height: 0, y: -6 }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
          className="overflow-hidden"
        >
          <div role="status" className="mt-5 rounded-2xl border border-[#c8a24a]/40 bg-[#c8a24a]/[0.08] p-4 text-left">
            <p className={`${SERIF} text-xl font-bold text-[#f3ead8]`}>¿Sois más de {max}? Llámanos</p>
            <p className="mt-1 text-sm text-[#f3ead8]/70">
              Para grupos preparamos la mesa contigo por teléfono o WhatsApp.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {telHref && (
                <a href={telHref} className={`${linkClass} bg-[#c8a24a] text-[#0f0d0b]`}>
                  <Phone aria-hidden="true" className="size-4" />
                  Llamar
                </a>
              )}
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} border border-[#c8a24a]/60 text-[#f3ead8] ${telHref ? "" : "col-span-2"}`}
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
