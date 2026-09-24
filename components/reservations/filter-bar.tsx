"use client";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ReservationStatus } from "@/types/database.types";
import type { Turno } from "@/lib/reservations/service-hours";

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "seated", label: "Sentada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No-show" },
];

const TURNO_OPTIONS: { value: Turno; label: string }[] = [
  { value: "lunch", label: "Comida" },
  { value: "dinner", label: "Cena" },
];

export interface ReservationFilters {
  search: string;
  statuses: ReservationStatus[];
  turnos: Turno[];
  tableFilter: "all" | "unassigned";
}

export const EMPTY_FILTERS: ReservationFilters = {
  search: "",
  statuses: [],
  turnos: [],
  tableFilter: "all",
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: ReservationFilters;
  onChange: (filters: ReservationFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o teléfono…"
          className="pl-8"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_OPTIONS.map((option) => {
          const active = filters.statuses.includes(option.value);
          return (
            <Badge
              key={option.value}
              variant={active ? "default" : "outline"}
              className={cn("cursor-pointer font-normal", !active && "text-muted-foreground")}
              onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, option.value) })}
            >
              {option.label}
            </Badge>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" />
        {TURNO_OPTIONS.map((option) => {
          const active = filters.turnos.includes(option.value);
          return (
            <Badge
              key={option.value}
              variant={active ? "default" : "outline"}
              className={cn("cursor-pointer font-normal", !active && "text-muted-foreground")}
              onClick={() => onChange({ ...filters, turnos: toggle(filters.turnos, option.value) })}
            >
              {option.label}
            </Badge>
          );
        })}
        <Select
          value={filters.tableFilter}
          onValueChange={(value) => onChange({ ...filters, tableFilter: value as ReservationFilters["tableFilter"] })}
        >
          <SelectTrigger size="sm" className="ml-auto w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las mesas</SelectItem>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
