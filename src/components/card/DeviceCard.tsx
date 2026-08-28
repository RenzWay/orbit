import { ChevronRight, Monitor, Trash2 } from "lucide-react";
import type { DeviceCardProps } from "@/types/orbit";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function DeviceCard({
  device,
  isSelected,
  onSelect,
  onUnsync,
}: DeviceCardProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <li
          data-device-card
          onClick={() => onSelect(device)}
          className={`group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            isSelected
              ? "border-sky-400/80 bg-linear-to-br from-sky-500/25 to-cyan-400/10 shadow-sm shadow-sky-500/10 dark:from-sky-500/25 dark:to-sky-400/5"
              : "border-transparent bg-slate-500/5 hover:border-sky-400/30 hover:bg-sky-500/10 dark:bg-white/5 dark:hover:bg-sky-400/10"
          }`}>
          {isSelected && (
            <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-sky-400" />
          )}

          <Avatar className="h-11 w-11 border border-white/50 shadow-sm dark:border-white/10">
            <AvatarFallback className="bg-linear-to-br from-sky-500 to-indigo-500 text-xs font-bold text-white">
              {device.deviceName.substring(0, 2).toUpperCase()}
            </AvatarFallback>

            <AvatarBadge
              className={
                device.status === "online"
                  ? "border-2 border-background bg-emerald-400 "
                  : "border-2 border-background bg-slate-400"
              }
            />
          </Avatar>

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold tracking-tight">
              {device.deviceName}
            </h4>

            <div className="mt-1 flex items-center gap-1.5">
              <Monitor size={12} className="text-muted-foreground" />
              <span
                className={`text-xs font-medium capitalize ${
                  device.status === "online"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}>
                {device.status}
              </span>
            </div>
          </div>

          <ChevronRight
            size={17}
            className={`shrink-0 transition-all duration-200 ${
              isSelected
                ? "translate-x-0 text-sky-500"
                : "-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
            }`}
          />
        </li>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem variant="destructive" onClick={() => onUnsync(device)}>
          <Trash2 />
          Unsync device
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
