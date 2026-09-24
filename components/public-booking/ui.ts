/** Clases compartidas de la página pública (lujo oscuro de El Bodegón). */

export const SERIF = "font-[family-name:var(--font-playfair)]";

export const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8a24a]";

/** Feedback de pulsado + relleno dorado con transición. */
export const PRESSABLE =
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

export const SECTION_LABEL = "text-[0.7rem] font-semibold tracking-[0.24em] text-[#f3ead8]/55 uppercase";

export const CHOICE_BASE = `border ${PRESSABLE} ${FOCUS_RING} disabled:cursor-not-allowed`;
export const CHOICE_IDLE = "border-[#f3ead8]/15 bg-[#f3ead8]/[0.03] text-[#f3ead8] hover:border-[#c8a24a]/60";
export const CHOICE_SELECTED = "border-[#c8a24a] bg-[#c8a24a] text-[#0f0d0b] shadow-[0_6px_24px_-8px_rgba(200,162,74,0.7)]";
export const CHOICE_DISABLED = "border-[#f3ead8]/5 bg-transparent text-[#f3ead8]/25";

export const ERROR_TEXT = "text-sm text-[#f0a08a]";
