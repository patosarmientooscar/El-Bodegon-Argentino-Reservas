@AGENTS.md

# Reglas del proyecto Reservas

- Stack fijo: Next.js 15 App Router + TypeScript + Supabase + TailwindCSS + shadcn/ui. No añadir otras librerías de UI ni de estado sin confirmar antes.
- Ediciones quirúrgicas: cambios pequeños y localizados, no reescrituras de archivos completos salvo que se pida explícitamente.
- Backup obligatorio (branch o copia) antes de cualquier cambio grande (migraciones de esquema, refactor de rutas).
- Nunca ocultar restricciones de permisos solo en el cliente — siempre a nivel de RLS en Supabase.
- Evaluaciones honestas de tradeoffs técnicos, no solo advertencias genéricas.

## Diseño UI

Antes de construir o tocar UI de Home, Reservations o Settings, aplica el skill `reservas-app-design` (ver [SKILL.md](./SKILL.md)) — define paleta, estados de mesa, tipografía y componentes de esta app.

## Base de datos

- Esquema y políticas RLS viven en `supabase/migrations/`. Cualquier cambio de esquema es una migración nueva, nunca se edita una migración ya aplicada.
- Tipos TypeScript en `types/database.types.ts`. Regenerar con `npm run db:types` una vez el proyecto esté enlazado a Supabase (`supabase link`).
