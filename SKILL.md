---
name: reservas-app-design
description: Sistema de diseño UI para la app Reservas (panel de gestión de reservas para restaurantes, SaaS Evimes). Usa este skill siempre que se construya o modifique UI de las páginas Home/Dashboard, Reservations o Settings — plano de mesas en vivo, badges de estado de mesa, vista lista/rejilla de reservas, KPIs, formularios y modales. Stack fijo: Next.js 15 App Router + TypeScript + Supabase + TailwindCSS + shadcn/ui. Activa también con menciones de "reservas", "plano de mesas", "dashboard del restaurante", o los nombres de las 3 páginas. No usar para el sitio de marketing/landing de Evimes ni para sitios de clientes (barberías, etc.) — este skill es solo para el panel operativo de Reservas.
---

# Reservas App — Design Skill

Panel de gestión operativa para restaurantes. Esto **no es una web de marca** — es una herramienta que un host o camarero mira 40 veces por turno, muchas veces con prisa y con el móvil en la mano. La prioridad es legibilidad y velocidad de lectura, no impacto visual. Es el polo opuesto del skill `barbershop-website`: ahí el objetivo es impresionar, aquí el objetivo es que nadie tenga que pensar.

---

## Cuándo usar este skill

Actívalo cuando Oscar pida:
- Construir o ajustar la página Home/Dashboard (plano de mesas, KPIs, próximas llegadas)
- Construir o ajustar Reservations (lista, rejilla horas×mesas, panel de detalle, filtros)
- Construir o ajustar Settings (editor de mesas, reglas, usuarios/roles)
- Cualquier componente compartido: badge de estado, tarjeta KPI, modal de nueva reserva

**No usar** para el sitio de marketing de Evimes ni para proyectos de clientes (barberías, etc.) — ahí aplica el design system correspondiente (ej. `barbershop-website`).

---

## Principios de diseño

1. **Escaneable antes que bonito.** Cada pantalla debe poder leerse en 2-3 segundos de un vistazo. Si una decisión de diseño obliga a detenerse a interpretar, es la decisión incorrecta para esta app.
2. **El color es información, no decoración.** El verde/ámbar/rojo/gris de las mesas comunica un estado operativo real. Nunca uses esos mismos colores para otra cosa en la misma pantalla (evita que un botón rojo se confunda con "mesa ocupada").
3. **Accesibilidad del color-estado.** No dependas solo del color — el daltonismo es común y en cocina/sala hay luz mala. Cada estado de mesa lleva también un icono o patrón (punto sólido = ocupada, punto con anillo = reservada, hueco = libre, diagonal = bloqueada), no solo relleno de color.
4. **Densidad controlada.** Es una app de datos — cabe más información por pantalla que en un sitio de marca — pero con jerarquía clara: KPI grande, detalle pequeño, acciones siempre visibles sin scroll extra.
5. **Sin movimiento decorativo.** Nada de fade-ins escalonados ni parallax. La única animación permitida es la que confirma una acción (una mesa que cambia de color, una fila que se expande, un toast que confirma "Reserva guardada").
6. **Mobile-first real**, no mobile-adaptado — el host suele mirar esto desde el móvil en mitad del servicio.

---

## Sistema de color

Paleta funcional, no la paleta cinematográfica de marca de Evimes (navy #080b14 / cian #00e5ff / púrpura #8b5cf6) — esa es para el sitio de marketing de Evimes, no para esta herramienta operativa. Aquí:

**Base (chrome de la app):**
- Fondo: gris muy claro `#F7F8FA` (modo claro, por defecto — sala con luz)
- Superficie/tarjetas: blanco `#FFFFFF` con borde `#E5E7EB`
- Texto principal: `#111827`, texto secundario: `#6B7280`

**Estados de mesa (el único lugar donde el color lleva significado fijo):**
- Disponible: verde `#22C55E`
- Reservada (dentro del buffer configurado): ámbar `#F59E0B`
- Ocupada: rojo `#EF4444`
- Bloqueada/mantenimiento: gris `#9CA3AF` con patrón diagonal

**Acento de marca (uso mínimo):** el púrpura `#8b5cf6` de Evimes puede usarse para acciones primarias (botón "+ Nueva reserva", enlaces activos) como único touch de marca — nunca en los estados de mesa, nunca como fondo de sección grande.

Usa `shadcn/ui` con estas variables sobreescritas en `globals.css`, no colores hardcodeados por componente.

---

## Tipografía

- Una sola familia sans-serif de sistema/UI (Inter o la que traiga shadcn por defecto) — nada de serif editorial aquí, eso es lenguaje de marca, no de herramienta.
- Los números (KPIs, horas, nº de mesa) en `font-variant-numeric: tabular-nums` para que no "bailen" al actualizarse en vivo.
- Jerarquía: KPI = grande/semibold, label de KPI = pequeño/gris, nombre de cliente en reserva = medium, metadatos (teléfono, origen) = pequeño/gris.

---

## Componentes por página

### Home
- `KpiCard`: valor grande + label + variación opcional (↑/↓ vs ayer). 4 en fila en desktop, scroll horizontal en mobile.
- `FloorPlanCanvas`: SVG, mesas como `<g>` con número centrado + color/patrón de estado. Click abre popover con resumen de la reserva activa/próxima.
- `NextArrivalsList`: lista compacta de 5, cada fila = hora + nombre + nº personas + mesa, click lleva al detalle en Reservations.
- `QuickActionButton`: fijo abajo-derecha en mobile (como el floating CTA del barbershop, pero funcional no promocional).

### Reservations
- `ViewToggle`: Lista ⇄ Rejilla, mismo componente `Tabs` de shadcn.
- `ReservationRow` (lista): hora, nombre, personas, mesa, `StatusBadge`, icono de origen.
- `ReservationGrid` (rejilla): mesas en eje Y, horas en eje X, bloques con drag handle. Solape = borde rojo + no permite soltar sin confirmar.
- `ReservationDetailSheet`: panel lateral (`Sheet` de shadcn), no modal centrado — así no tapa el contexto de la lista/rejilla.
- `FilterBar`: chips de filtro (estado, turno, tamaño), no un formulario largo.

### Settings
- Navegación por `Tabs` verticales o acordeón (Perfil, Mesas, Turnos, Reglas, Notificaciones, Usuarios, Bloqueos).
- `TableEditor`: mismo canvas SVG que `FloorPlanCanvas` pero editable (drag para posicionar, click para editar capacidad/forma).
- `RoleBadge`: distinción visual clara Admin vs Staff (no solo texto) en la lista de usuarios.

---

## Patrones reutilizables

**StatusBadge**
```tsx
// color + icono, nunca solo color
<Badge className="bg-green-50 text-green-700 border-green-200">
  <CircleDot className="h-3 w-3" /> Disponible
</Badge>
```

**Buffer visual en el plano**
Mesa "reservada" (ámbar) debe mostrar cuenta atrás o la hora de llegada en el tooltip/popover — el color solo no basta, hay que decir *cuándo*.

**Empty states**
Nunca una pantalla vacía sin explicación. "Sin reservas para hoy" + botón "+ Nueva reserva", en la voz de la interfaz, no genérico tipo "No data".

---

## Checklist de entrega

- [ ] Todos los estados de mesa tienen color + icono/patrón (no dependen solo del color)
- [ ] KPIs con `tabular-nums`, no saltan de ancho al actualizar
- [ ] Vista Lista y Rejilla muestran los mismos datos (mismo dataset, no duplicado)
- [ ] Panel de detalle es `Sheet` lateral, no tapa el listado
- [ ] Probado en 375px sin scroll horizontal roto
- [ ] Acciones (nueva reserva, cambiar estado) accesibles sin scroll extra en mobile
- [ ] RLS de Supabase probado con un usuario Staff (no solo ocultar botones en cliente)
- [ ] Sin animaciones decorativas — solo las que confirman una acción
- [ ] Contraste de texto/fondo pasa AA (útil en sala con luz variable)

---

## Errores comunes a evitar

- ❌ Traer el navy/cian/púrpura cinematográfico de la marca Evimes a toda la UI — eso es para el marketing, no para la herramienta de trabajo diario
- ❌ Usar rojo/verde/ámbar fuera del contexto de estado de mesa (confunde la lectura del plano)
- ❌ Modal centrado para el detalle de reserva — tapa el contexto, usa `Sheet` lateral
- ❌ Confiar el estado de mesa solo al color sin icono/patrón
- ❌ Animaciones de entrada en cascada (fade+slide en cada KPI card) — esto es un dashboard operativo, no una landing
- ❌ Ocultar acciones de Staff solo en el cliente sin política RLS real
- ❌ Vista Rejilla sin validación de solape en servidor antes de guardar un drag&drop

---

**Recuerda: si dudas entre "más bonito" o "más legible en 2 segundos", gana legible.**
