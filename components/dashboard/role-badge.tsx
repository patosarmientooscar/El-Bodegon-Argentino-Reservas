import { ShieldCheck, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/database.types";

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const isAdmin = role === "admin";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-normal",
        isAdmin ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground",
        className,
      )}
    >
      {isAdmin ? <ShieldCheck className="size-3" /> : <User className="size-3" />}
      {isAdmin ? "Admin" : "Staff"}
    </Badge>
  );
}
