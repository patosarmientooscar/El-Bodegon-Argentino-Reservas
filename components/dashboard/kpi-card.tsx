import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <Card className="min-w-[140px] shrink-0 gap-0 py-4">
      <CardContent className="px-4">
        <p className="text-2xl font-semibold tabular-nums leading-none">
          {value}
          {suffix && <span className="ml-0.5 text-base font-medium text-muted-foreground">{suffix}</span>}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
