/*
 * Motor de la mesa animada (versión TypeScript de "reservas page/js/ui/
 * spring.js" + "mesa.js"). Mismo dibujo y misma coreografía en las dos
 * páginas: si cambias uno, cambia el otro.
 *
 * - Tablero = UN contorno que se transforma (morphing) entre redonda (1),
 *   ovalada (2), rectangular (3) y casi cuadrada (4), con muelles físicos.
 * - Madera con veta (ruido SVG), sillas de nogal y cuero, porcelana,
 *   cubiertos y copa de cristal. setServed(true) enciende vela y vino.
 * Solo navegador: manipula el DOM directamente, fuera del render de React.
 */

// ---------------------------------------------------------------- muelles

class Spring {
  x: number;
  target: number;
  v = 0;
  delay = 0;
  private k: number;
  private c: number;
  private precision: number;

  constructor(value: number, opts: { stiffness: number; damping: number; precision: number }) {
    this.x = value;
    this.target = value;
    this.k = opts.stiffness;
    this.c = opts.damping;
    this.precision = opts.precision;
  }

  to(target: number, delay = 0) {
    this.target = target;
    this.delay = delay;
  }

  jump(value: number) {
    this.x = this.target = value;
    this.v = 0;
    this.delay = 0;
  }

  step(dt: number): boolean {
    if (this.delay > 0) {
      this.delay -= dt;
      return true;
    }
    const h = 1 / 240;
    while (dt > 0) {
      const s = Math.min(h, dt);
      const f = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += f * s;
      this.x += this.v * s;
      dt -= s;
    }
    if (Math.abs(this.v) < this.precision && Math.abs(this.x - this.target) < this.precision) {
      this.x = this.target;
      this.v = 0;
      return false;
    }
    return true;
  }
}

class Tween {
  x: number;
  t = 1;
  private from: number;
  private target: number;
  private duration = 0.3;
  private easing: "in" | "inOut" = "in";

  constructor(value: number) {
    this.x = this.from = this.target = value;
  }

  to(target: number, duration: number, easing: "in" | "inOut" = "in") {
    this.easing = easing;
    this.from = this.x;
    this.target = target;
    this.t = 0;
    this.duration = duration;
  }

  jump(value: number) {
    this.x = this.from = this.target = value;
    this.t = 1;
  }

  step(dt: number): boolean {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / this.duration);
    const t = this.t;
    const e = this.easing === "in" ? t * t * t : t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.x = this.from + (this.target - this.from) * e;
    return this.t < 1;
  }
}

// ---------------------------------------------------------------- geometría

const CX = 180;
const CY = 134;
const CHAIR_GAP = 15;
const PLATE_INSET = 29;
const STAGGER = 0.06;

type Seat = "bottom" | "top" | "left" | "right";
const SEATS: Seat[] = ["bottom", "top", "left", "right"];
const ROT: Record<Seat, number> = { bottom: 0, top: 180, left: 90, right: -90 };
const OUT: Record<Seat, [number, number]> = { bottom: [0, 1], top: [0, -1], left: [-1, 0], right: [1, 0] };
const SHAPES: Record<number, { w: number; h: number; r: number; shift: number }> = {
  1: { w: 106, h: 106, r: 53, shift: 0 },
  2: { w: 106, h: 142, r: 53, shift: 0 },
  3: { w: 190, h: 110, r: 18, shift: 18 },
  4: { w: 154, h: 144, r: 16, shift: 0 },
};

const f = (n: number) => Math.round(n * 100) / 100;

function roundedRect(cx: number, cy: number, w: number, h: number, r: number): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, k = r * 0.5523;
  return (
    `M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}` +
    `C${f(x1 - r + k)} ${f(y0)} ${f(x1)} ${f(y0 + r - k)} ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}` +
    `C${f(x1)} ${f(y1 - r + k)} ${f(x1 - r + k)} ${f(y1)} ${f(x1 - r)} ${f(y1)}H${f(x0 + r)}` +
    `C${f(x0 + r - k)} ${f(y1)} ${f(x0)} ${f(y1 - r + k)} ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}` +
    `C${f(x0)} ${f(y0 + r - k)} ${f(x0 + r - k)} ${f(y0)} ${f(x0 + r)} ${f(y0)}Z`
  );
}

function seatPos(seat: Seat, w: number, h: number, shift: number, offset: number) {
  switch (seat) {
    case "bottom":
      return { x: CX + shift, y: CY + h / 2 + offset };
    case "top":
      return { x: CX + shift, y: CY - h / 2 - offset };
    case "left":
      return { x: CX - w / 2 - offset, y: CY };
    case "right":
      return { x: CX + w / 2 + offset, y: CY };
  }
}

// ---------------------------------------------------------------- dibujo

const CHAIR =
  '<ellipse cx="0" cy="7" rx="25" ry="21" fill="#3a2a18" opacity=".30" filter="url(#rv-blur-s)"/>' +
  '<rect x="-21" y="-17" width="42" height="34" rx="11" fill="url(#rv-walnut)"/>' +
  '<rect x="-17" y="-14" width="34" height="27" rx="9" fill="url(#rv-leather)"/>' +
  '<rect x="-14.5" y="-11.5" width="29" height="22" rx="7" fill="none" stroke="#2b1408" stroke-opacity=".28" stroke-width=".8" stroke-dasharray="1.6 1.4"/>' +
  '<ellipse cx="-3" cy="-6" rx="10" ry="4" fill="#fff" opacity=".10"/>' +
  '<path d="M-23 11 Q0 28 23 11 L23 15.5 Q0 33.5 -23 15.5 Z" fill="url(#rv-walnut-back)"/>' +
  '<path d="M-20.5 12.6 Q0 28 20.5 12.6" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width=".8"/>';

const FORK =
  '<g transform="translate(-23 1)" fill="url(#rv-silver)">' +
  '<rect x="-.9" y="-3" width="1.8" height="15" rx=".9"/>' +
  '<rect x="-2.6" y="-6" width="5.2" height="3.6" rx="1.4"/>' +
  '<rect x="-2.5" y="-12" width=".8" height="6.6" rx=".4"/><rect x="-.4" y="-12" width=".8" height="6.6" rx=".4"/><rect x="1.7" y="-12" width=".8" height="6.6" rx=".4"/>' +
  "</g>";

const KNIFE =
  '<g transform="translate(23 1)">' +
  '<path d="M-1.2 12 L-1.2 -3 C-1.2 -9 .2 -12 1.6 -12.5 L1.6 12 Z" fill="url(#rv-silver)"/>' +
  '<rect x="-1.3" y="3" width="3" height="9" rx="1.2" fill="#8d8a82" opacity=".55"/>' +
  "</g>";

const GLASS =
  '<g transform="translate(19 -21)">' +
  '<circle cx="1.6" cy="2" r="6" fill="#2a1a0c" opacity=".22" filter="url(#rv-blur-xs)"/>' +
  '<circle r="6.2" fill="url(#rv-glass)" stroke="#ffffff" stroke-opacity=".9" stroke-width=".9"/>' +
  '<circle r="6.2" fill="none" stroke="#5f6d76" stroke-opacity=".3" stroke-width=".45"/>' +
  '<circle class="rv-wine" r="4.3" fill="url(#rv-wine)" opacity="0"/>' +
  '<path d="M-3.6 -2.6 A4.4 4.4 0 0 1 1 -4.6" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".9"/>' +
  '<circle class="rv-glint" cx="2.4" cy="2.2" r="1.3" fill="#ffd98a" opacity="0"/>' +
  "</g>";

const SETTING =
  '<circle r="17" fill="#efe8da" stroke="#c8a84e" stroke-width="1.1"/>' +
  '<circle r="12.6" fill="url(#rv-porcelain)" stroke="#8a7550" stroke-opacity=".22" stroke-width=".6"/>' +
  '<circle r="8.4" fill="none" stroke="#8a7550" stroke-opacity=".14" stroke-width=".6"/>' +
  '<ellipse cx="-4.5" cy="-5.5" rx="4.6" ry="2" fill="#fff" opacity=".75" transform="rotate(-32 -4.5 -5.5)"/>' +
  FORK +
  KNIFE +
  GLASS;

const SVG =
  '<svg viewBox="0 0 360 268" class="rv-mesa-svg" aria-hidden="true" focusable="false">' +
  "<defs>" +
  '<filter id="rv-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
  '<feTurbulence type="fractalNoise" baseFrequency="0.007 0.15" numOctaves="3" seed="11" result="n"/>' +
  '<feColorMatrix in="n" type="matrix" values="0.34 0 0 0 0.29  0.23 0 0 0 0.165  0.13 0 0 0 0.075  0 0 0 0 1"/>' +
  "</filter>" +
  '<pattern id="rv-wood" patternUnits="userSpaceOnUse" x="0" y="0" width="360" height="268"><rect width="360" height="268" filter="url(#rv-grain)"/></pattern>' +
  '<radialGradient id="rv-sheen" cx=".32" cy=".26" r=".95"><stop offset="0" stop-color="#ffe9cc" stop-opacity=".30"/><stop offset=".45" stop-color="#ffe9cc" stop-opacity=".05"/><stop offset="1" stop-color="#1a0d04" stop-opacity=".30"/></radialGradient>' +
  '<radialGradient id="rv-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".75"/><stop offset=".6" stop-color="#ffffff" stop-opacity=".25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="rv-walnut" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a4426"/><stop offset="1" stop-color="#3b2413"/></linearGradient>' +
  '<linearGradient id="rv-walnut-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c3a20"/><stop offset="1" stop-color="#2e1b0d"/></linearGradient>' +
  '<radialGradient id="rv-leather" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#b0683c"/><stop offset=".7" stop-color="#8a4a26"/><stop offset="1" stop-color="#6a3519"/></radialGradient>' +
  '<radialGradient id="rv-porcelain" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".72" stop-color="#f6f1e8"/><stop offset="1" stop-color="#e2d9ca"/></radialGradient>' +
  '<radialGradient id="rv-glass" cx=".42" cy=".38" r=".62"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".06"/><stop offset=".86" stop-color="#e3ebf0" stop-opacity=".38"/><stop offset="1" stop-color="#ffffff" stop-opacity=".8"/></radialGradient>' +
  '<radialGradient id="rv-wine" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#9c2440"/><stop offset="1" stop-color="#4e0a19"/></radialGradient>' +
  '<linearGradient id="rv-silver" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6f6f3"/><stop offset=".5" stop-color="#c9c8c2"/><stop offset="1" stop-color="#9b9a94"/></linearGradient>' +
  '<radialGradient id="rv-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd48a" stop-opacity=".62"/><stop offset=".4" stop-color="#ffc56a" stop-opacity=".2"/><stop offset="1" stop-color="#ffc56a" stop-opacity="0"/></radialGradient>' +
  '<filter id="rv-blur-xs" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>' +
  '<filter id="rv-blur-s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5"/></filter>' +
  '<filter id="rv-blur-l" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>' +
  '<filter id="rv-flame-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
  "</defs>" +
  '<ellipse cx="180" cy="140" rx="178" ry="124" fill="url(#rv-floor)"/>' +
  '<g class="rv-chairs"></g>' +
  '<path class="rv-t-shadow" fill="#3a2812" opacity=".42" filter="url(#rv-blur-l)" transform="translate(0 12)"/>' +
  '<path class="rv-t-top" fill="url(#rv-wood)"/>' +
  '<path class="rv-t-sheen" fill="url(#rv-sheen)"/>' +
  '<path class="rv-t-edge" fill="none" stroke="#24140a" stroke-opacity=".55" stroke-width="1.6"/>' +
  '<path class="rv-t-bevel" fill="none" stroke="#ffe8c6" stroke-opacity=".18" stroke-width="1"/>' +
  `<circle class="rv-glow" cx="${CX}" cy="${CY}" r="104" fill="url(#rv-glow)" opacity="0"/>` +
  '<g class="rv-settings"></g>' +
  `<g class="rv-candle" transform="translate(${CX} ${CY})">` +
  '<circle cx="1.8" cy="2.2" r="9.2" fill="#2a1a0c" opacity=".2" filter="url(#rv-blur-xs)"/>' +
  '<circle r="9.5" fill="url(#rv-glass)" stroke="#ffffff" stroke-opacity=".9" stroke-width=".9"/>' +
  '<circle r="6.2" fill="#f4ede0"/><circle r="1.1" fill="#3a2a1a"/>' +
  '<g class="rv-flame" opacity="0" filter="url(#rv-flame-glow)"><ellipse cy="-1.2" rx="2.5" ry="4" fill="#ffc861"/><ellipse cy="-.5" rx="1.1" ry="2.1" fill="#fff7dc"/></g>' +
  "</g>" +
  "</svg>";

// ---------------------------------------------------------------- mesa

interface SeatState {
  name: Seat;
  chair: SVGGElement;
  setting: SVGGElement;
  wine: SVGElement;
  glint: SVGElement;
  presence: Spring;
  dish: Spring;
  exit: Tween;
  active: boolean;
}

export class MesaEngine {
  private container: HTMLElement;
  private reduced: boolean;
  private el: Record<"shadow" | "top" | "sheen" | "edge" | "bevel" | "glow" | "flame", SVGElement>;
  private w: Spring;
  private h: Spring;
  private r: Spring;
  private shift: Spring;
  private served = new Tween(0);
  private seats: SeatState[];
  private first = true;
  private raf = 0;
  private last = 0;
  private destroyed = false;

  constructor(container: HTMLElement, reduced: boolean) {
    this.container = container;
    this.reduced = reduced;
    container.innerHTML = SVG;
    const svg = container.querySelector("svg")!;
    const q = (sel: string) => svg.querySelector(sel) as SVGElement;
    this.el = {
      shadow: q(".rv-t-shadow"),
      top: q(".rv-t-top"),
      sheen: q(".rv-t-sheen"),
      edge: q(".rv-t-edge"),
      bevel: q(".rv-t-bevel"),
      glow: q(".rv-glow"),
      flame: q(".rv-flame"),
    };

    const start = SHAPES[2];
    const table = { stiffness: 170, damping: 18, precision: 0.02 };
    this.w = new Spring(start.w, table);
    this.h = new Spring(start.h, table);
    this.r = new Spring(start.r, table);
    this.shift = new Spring(start.shift, table);

    const chairs = q(".rv-chairs");
    const settings = q(".rv-settings");
    const ns = "http://www.w3.org/2000/svg";
    this.seats = SEATS.map((name) => {
      const chair = document.createElementNS(ns, "g");
      chair.innerHTML = CHAIR;
      chair.setAttribute("opacity", "0");
      chairs.appendChild(chair);
      const setting = document.createElementNS(ns, "g");
      setting.innerHTML = SETTING;
      setting.setAttribute("opacity", "0");
      settings.appendChild(setting);
      return {
        name,
        chair,
        setting,
        wine: setting.querySelector(".rv-wine") as SVGElement,
        glint: setting.querySelector(".rv-glint") as SVGElement,
        presence: new Spring(0, { stiffness: 520, damping: 15, precision: 0.002 }),
        dish: new Spring(0, { stiffness: 460, damping: 18, precision: 0.002 }),
        exit: new Tween(0),
        active: false,
      };
    });
    this.render();
  }

  setReduced(reduced: boolean) {
    this.reduced = reduced;
  }

  setCount(count: number) {
    const n = Math.max(1, Math.min(4, count));
    const shape = SHAPES[n];
    const reduced = this.reduced;
    const first = this.first;
    const go = (s: Spring, v: number) => (reduced ? s.jump(v) : s.to(v));
    go(this.w, shape.w);
    go(this.h, shape.h);
    go(this.r, shape.r);
    go(this.shift, shape.shift);

    this.seats.forEach((s, i) => {
      if (i < n && !s.active) {
        s.active = true;
        s.exit.jump(0);
        const delay = first ? 0.15 + i * STAGGER : STAGGER;
        if (reduced) {
          s.presence.jump(1);
          s.dish.jump(1);
        } else {
          s.presence.jump(0);
          s.dish.jump(0);
          s.presence.to(1, delay);
          s.dish.to(1, delay + 0.09);
        }
      } else if (i >= n && s.active) {
        s.active = false;
        if (reduced) {
          s.presence.jump(0);
          s.dish.jump(0);
        } else {
          s.exit.to(1, 0.3);
        }
      }
    });
    this.first = false;
    this.render();
    this.start();
  }

  setServed(on: boolean) {
    if (this.reduced) this.served.jump(on ? 1 : 0);
    else this.served.to(on ? 1 : 0, 1.1, "inOut");
    this.container.classList.toggle("is-served", on);
    this.render();
    this.start();
  }

  shake() {
    if (this.reduced) return;
    const c = this.container;
    c.classList.remove("is-shaking");
    void c.offsetWidth; // reinicia la animación CSS
    c.classList.add("is-shaking");
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
  }

  private start() {
    if (this.reduced || this.raf || this.destroyed) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (ts: number) => {
    const dt = Math.min((ts - this.last) / 1000, 1 / 30);
    this.last = ts;
    let moving = false;
    const all: { step(dt: number): boolean }[] = [this.w, this.h, this.r, this.shift, this.served];
    this.seats.forEach((s) => all.push(s.presence, s.dish, s.exit));
    all.forEach((a) => {
      if (a.step(dt)) moving = true;
    });
    this.seats.forEach((s) => {
      if (!s.active && s.exit.t >= 1 && s.exit.x === 1) {
        s.presence.jump(0);
        s.dish.jump(0);
        s.exit.jump(0);
      }
    });
    this.render();
    this.raf = moving && !this.destroyed ? requestAnimationFrame(this.frame) : 0;
  };

  private render() {
    const w = this.w.x, h = this.h.x, r = this.r.x, shift = this.shift.x;
    const d = roundedRect(CX, CY, w, h, r);
    this.el.shadow.setAttribute("d", d);
    this.el.top.setAttribute("d", d);
    this.el.sheen.setAttribute("d", d);
    this.el.edge.setAttribute("d", d);
    this.el.bevel.setAttribute("d", roundedRect(CX, CY, w - 9, h - 9, Math.max(r - 4.5, 2)));

    const served = this.served.x;
    this.el.glow.setAttribute("opacity", String(f(served)));
    this.el.flame.setAttribute("opacity", String(f(served)));

    this.seats.forEach((s) => {
      const e = s.exit.x;
      const [ox, oy] = OUT[s.name];
      const p = s.presence.x;
      const cp = seatPos(s.name, w, h, shift, CHAIR_GAP);
      s.chair.setAttribute("opacity", String(f(Math.max(0, Math.min(1, p * 1.6)) * (1 - e))));
      s.chair.setAttribute(
        "transform",
        `translate(${f(cp.x + ox * e * 36)} ${f(cp.y + oy * e * 36)}) rotate(${ROT[s.name]}) scale(${f(Math.max(0, p))})`,
      );

      const dp = s.dish.x;
      const sp = seatPos(s.name, w, h, shift, -PLATE_INSET);
      s.setting.setAttribute("opacity", String(f(Math.max(0, Math.min(1, dp * 1.6)) * (1 - e))));
      s.setting.setAttribute(
        "transform",
        `translate(${f(sp.x)} ${f(sp.y)}) rotate(${ROT[s.name]}) scale(${f(Math.max(0, dp) * (1 - e * 0.35))})`,
      );
      s.wine.setAttribute("opacity", String(f(served * 0.92)));
      s.glint.setAttribute("opacity", String(f(served)));
    });
  }
}
