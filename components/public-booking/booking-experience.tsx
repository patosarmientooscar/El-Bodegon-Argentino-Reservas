"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlert, LoaderCircle, Minus, Plus } from "lucide-react";

import { createBooking, type BookingField } from "@/app/r/[slug]/actions";
import type { PublicRestaurant } from "@/lib/public-booking/data";
import { DEFAULT_PHONE_PREFIX, normalizePhone, validateName } from "@/lib/public-booking/phone";
import { buildDayOptions, buildSlots } from "@/lib/public-booking/schedule";

import { DateChips } from "./date-chips";
import { GroupNotice } from "./group-notice";
import { PartyCount } from "./party-count";
import { PublicHeader } from "./public-header";
import { SuccessView, type ConfirmedBooking } from "./success-view";
import { TableIllustration } from "./table-illustration";
import { TimeSlots } from "./time-slots";
import { ERROR_TEXT, FOCUS_RING, PRESSABLE, SECTION_LABEL } from "./ui";

const DEFAULT_PARTY_SIZE = 2;

const INPUT_CLASS = `h-[3.25rem] rounded-xl border bg-[#f3ead8]/[0.04] px-4 text-base text-[#f3ead8] placeholder:text-[#f3ead8]/35 transition-colors focus-visible:border-[#c8a24a] ${FOCUS_RING}`;

const STEPPER_BUTTON = `flex size-14 items-center justify-center rounded-full border border-[#c8a24a]/60 text-[#c8a24a] hover:bg-[#c8a24a]/10 disabled:border-[#f3ead8]/10 disabled:text-[#f3ead8]/25 disabled:hover:bg-transparent ${PRESSABLE} ${FOCUS_RING}`;

type FieldErrors = Partial<Record<BookingField, string>>;

export function BookingExperience({ restaurant, nowISO }: { restaurant: PublicRestaurant; nowISO: string }) {
  const { rules } = restaurant;
  const reduced = useReducedMotion() ?? false;

  // "Ahora" viene del servidor para que el primer render coincida; luego se
  // refresca cada minuto para ir deshabilitando las franjas que pasan.
  const [now, setNow] = useState(() => new Date(nowISO));
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const days = useMemo(() => buildDayOptions(rules, now), [rules, now]);

  const [partySize, setPartySize] = useState(Math.min(DEFAULT_PARTY_SIZE, rules.maxPartySize));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [shakeSignal, setShakeSignal] = useState(0);
  const [groupNoticeOpen, setGroupNoticeOpen] = useState(false);
  const [date, setDate] = useState<string | null>(() => days.find((d) => !d.disabled)?.date ?? null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phonePrefix, setPhonePrefix] = useState(DEFAULT_PHONE_PREFIX);
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);
  const [isPending, startTransition] = useTransition();

  const slots = useMemo(() => (date ? buildSlots(rules, date, now) : []), [rules, date, now]);

  function clearError(field: BookingField) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function increment() {
    if (partySize >= rules.maxPartySize) {
      setGroupNoticeOpen(true);
      setShakeSignal((n) => n + 1);
      return;
    }
    setDirection(1);
    setPartySize(partySize + 1);
    clearError("partySize");
  }

  function decrement() {
    if (partySize <= 1) return;
    setDirection(-1);
    setPartySize(partySize - 1);
    setGroupNoticeOpen(false);
  }

  function selectDate(next: string) {
    setDate(next);
    clearError("date");
    // Si la misma hora existe ese día, se mantiene: un toque menos.
    if (time && !buildSlots(rules, next, now).some((s) => s.time === time && s.available)) setTime(null);
  }

  function selectTime(next: string) {
    setTime(next);
    clearError("time");
  }

  function focusField(field: BookingField) {
    const target =
      field === "name"
        ? document.getElementById("pb-name")
        : field === "phone"
          ? document.getElementById("pb-phone")
          : field === "date"
            ? document.getElementById("pb-date-label")
            : field === "time"
              ? document.getElementById("pb-time-label")
              : null;
    target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (target instanceof HTMLInputElement) target.focus({ preventScroll: true });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setFormError(null);

    const errors: FieldErrors = {};
    if (!date) errors.date = "Elige un día.";
    if (!time) errors.time = "Elige a qué hora venís.";
    const nameError = validateName(name);
    if (nameError) errors.name = nameError;
    const phoneResult = normalizePhone(phonePrefix, phone);
    if (!phoneResult.ok) errors.phone = phoneResult.message;

    setFieldErrors(errors);
    const firstInvalid = (["date", "time", "name", "phone"] as const).find((f) => errors[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    startTransition(async () => {
      try {
        const result = await createBooking({
          slug: restaurant.slug,
          partySize,
          date: date!,
          time: time!,
          name,
          phonePrefix,
          phone,
        });
        if (result.ok) {
          setBooking(result.booking);
          window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
          return;
        }
        setFormError(result.message);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
          if (result.fieldErrors.time) {
            setTime(null);
            setNow(new Date());
          }
          if (result.fieldErrors.partySize) setGroupNoticeOpen(true);
        }
      } catch {
        setFormError("Parece que no hay conexión. Revisa tu internet e inténtalo otra vez.");
      }
    });
  }

  const served = booking !== null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+7.5rem)] md:pb-12">
      <PublicHeader name={restaurant.name} />

      <div className="mx-auto mt-4 w-full max-w-[21rem]">
        <TableIllustration count={partySize} shakeSignal={shakeSignal} served={served} reduced={reduced} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {booking ? (
          <motion.div
            key="success"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut", delay: 0.1 }}
            className="mt-2"
          >
            <SuccessView slug={restaurant.slug} booking={booking} />
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={handleSubmit}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -12, transition: { duration: 0.25 } }}
            className="flex flex-col"
          >
            {/* Personas */}
            <section aria-labelledby="pb-party-label" className="text-center">
              <h2 id="pb-party-label" className="sr-only">
                Personas
              </h2>
              <PartyCount count={partySize} direction={direction} reduced={reduced} />
              <div className="mt-5 flex items-center justify-center gap-8">
                <button
                  type="button"
                  onClick={decrement}
                  disabled={partySize <= 1}
                  aria-label="Quitar una persona"
                  className={STEPPER_BUTTON}
                >
                  <Minus aria-hidden="true" className="size-5" />
                </button>
                <span className={SECTION_LABEL}>Personas</span>
                <button type="button" onClick={increment} aria-label="Añadir una persona" className={STEPPER_BUTTON}>
                  <Plus aria-hidden="true" className="size-5" />
                </button>
              </div>
              <GroupNotice
                open={groupNoticeOpen}
                max={rules.maxPartySize}
                telHref={restaurant.telHref}
                whatsappHref={restaurant.whatsappHref}
                reduced={reduced}
              />
              {fieldErrors.partySize && <p className={`mt-2 ${ERROR_TEXT}`}>{fieldErrors.partySize}</p>}
            </section>

            <div className="mt-9">
              <DateChips days={days} value={date} onChange={selectDate} />
              {fieldErrors.date && <p className={`mt-2 ${ERROR_TEXT}`}>{fieldErrors.date}</p>}
            </div>

            <div className="mt-8">
              <TimeSlots slots={slots} value={time} onChange={selectTime} error={fieldErrors.time} />
            </div>

            {/* Tus datos */}
            <div className="mt-8 flex flex-col gap-5">
              <div>
                <label htmlFor="pb-name" className={SECTION_LABEL}>
                  Nombre
                </label>
                <input
                  id="pb-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  placeholder="¿A nombre de quién?"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearError("name");
                  }}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "pb-name-error" : undefined}
                  className={`mt-2 w-full ${INPUT_CLASS} ${fieldErrors.name ? "border-[#f0a08a]/70" : "border-[#f3ead8]/15"}`}
                />
                {fieldErrors.name && (
                  <p id="pb-name-error" className={`mt-2 ${ERROR_TEXT}`}>
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="pb-phone" className={SECTION_LABEL}>
                  Teléfono
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    aria-label="Prefijo del país"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-country-code"
                    value={phonePrefix}
                    onChange={(e) => {
                      setPhonePrefix(e.target.value);
                      clearError("phone");
                    }}
                    className={`${INPUT_CLASS} w-[5.25rem] shrink-0 text-center ${fieldErrors.phone ? "border-[#f0a08a]/70" : "border-[#f3ead8]/15"}`}
                  />
                  <input
                    id="pb-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    enterKeyHint="done"
                    placeholder="612 345 678"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      clearError("phone");
                    }}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "pb-phone-error" : undefined}
                    className={`${INPUT_CLASS} min-w-0 flex-1 ${fieldErrors.phone ? "border-[#f0a08a]/70" : "border-[#f3ead8]/15"}`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p id="pb-phone-error" className={`mt-2 ${ERROR_TEXT}`}>
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
            </div>

            <div aria-live="assertive">
              {formError && (
                <p className="mt-6 flex items-start gap-2 rounded-xl border border-[#f0a08a]/30 bg-[#f0a08a]/[0.07] px-4 py-3 text-sm text-[#f6c3b5]">
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {formError}
                </p>
              )}
            </div>

            {/* Botón fijo abajo en móvil, en línea en escritorio */}
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#f3ead8]/10 bg-[#0f0d0b]/90 px-5 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
              <div className="mx-auto max-w-md">
                <button
                  type="submit"
                  disabled={isPending}
                  className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#c8a24a] text-[1.05rem] font-semibold text-[#0f0d0b] shadow-[0_10px_30px_-10px_rgba(200,162,74,0.8)] hover:bg-[#d4b05a] disabled:opacity-80 ${PRESSABLE} ${FOCUS_RING}`}
                >
                  {isPending ? (
                    <>
                      <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
                      Reservando…
                    </>
                  ) : (
                    "Reservar mesa"
                  )}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </main>
  );
}
