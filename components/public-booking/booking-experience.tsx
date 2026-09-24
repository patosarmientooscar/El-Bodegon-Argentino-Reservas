"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useReducedMotion } from "motion/react";

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

const DEFAULT_PARTY_SIZE = 2;

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
  const selectedDay = days.find((d) => d.date === date);

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
    const id = { name: "pb-name", phone: "pb-phone", date: "pb-date-label", time: "pb-time-label", partySize: "pb-party" }[field];
    const target = document.getElementById(id);
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

  return (
    <main className="rv">
      {/* Escenario: marca + mesa + personas */}
      <section className="rv-stage" aria-labelledby="rv-title">
        <PublicHeader name={restaurant.name} />
        <TableIllustration count={partySize} shakeSignal={shakeSignal} served={booking !== null} reduced={reduced} />

        {!booking && (
          <div className="rv-party" id="pb-party">
            <PartyCount count={partySize} direction={direction} reduced={reduced} />
            <div className="rv-stepper" role="group" aria-label="Personas">
              <button
                type="button"
                className="rv-step rv-step-minus"
                onClick={decrement}
                disabled={partySize <= 1}
                aria-label="Quitar una persona"
              />
              <span className="rv-label">Personas</span>
              <button type="button" className="rv-step rv-step-plus" onClick={increment} aria-label="Añadir una persona" />
            </div>
            <GroupNotice
              open={groupNoticeOpen}
              max={rules.maxPartySize}
              telHref={restaurant.telHref}
              whatsappHref={restaurant.whatsappHref}
            />
            {fieldErrors.partySize && <p className="rv-error">{fieldErrors.partySize}</p>}
          </div>
        )}
      </section>

      {/* Panel: formulario o éxito */}
      <section className="rv-panel" aria-label="Datos de la reserva">
        {booking ? (
          <SuccessView slug={restaurant.slug} booking={booking} />
        ) : (
          <form noValidate onSubmit={handleSubmit}>
            <DateChips days={days} value={date} onChange={selectDate} error={fieldErrors.date} />
            <TimeSlots slots={slots} value={time} onChange={selectTime} error={fieldErrors.time} />

            <div className="rv-field">
              <label htmlFor="pb-name" className="rv-label">
                Nombre
              </label>
              <input
                id="pb-name"
                name="name"
                className="rv-input"
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
              />
              {fieldErrors.name && (
                <p id="pb-name-error" className="rv-error">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="rv-field">
              <label htmlFor="pb-phone" className="rv-label">
                Teléfono
              </label>
              <div className="rv-phone">
                <input
                  className="rv-input rv-prefix"
                  aria-label="Prefijo del país"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-country-code"
                  value={phonePrefix}
                  onChange={(e) => {
                    setPhonePrefix(e.target.value);
                    clearError("phone");
                  }}
                />
                <input
                  id="pb-phone"
                  name="phone"
                  className="rv-input"
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
                />
              </div>
              {fieldErrors.phone && (
                <p id="pb-phone-error" className="rv-error">
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            <div aria-live="assertive">{formError && <p className="rv-alert">{formError}</p>}</div>

            <div className="rv-bar">
              <div className="rv-bar-inner">
                <p className="rv-summary" aria-hidden="true">
                  {selectedDay && (
                    <b>
                      {selectedDay.label} {selectedDay.dayNumber}
                    </b>
                  )}
                  {selectedDay && " · "}
                  {time ? <b>{time}</b> : "elige hora"}
                  {" · "}
                  {partySize} {partySize === 1 ? "persona" : "personas"}
                </p>
                <button type="submit" className="rv-cta" aria-busy={isPending}>
                  {isPending ? (
                    <>
                      <span className="rv-spinner" aria-hidden="true" />
                      Reservando…
                    </>
                  ) : (
                    "Reservar mesa"
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
