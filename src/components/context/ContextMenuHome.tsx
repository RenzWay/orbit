import type { ContextMenuHomeProps } from "@/types/orbit";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "../ui/context-menu";
import { Kbd, KbdGroup } from "../ui/kbd";

export function ContextMenuHome({ children }: ContextMenuHomeProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => window.location.reload()}>
          Refresh
          <KbdGroup className="ml-auto">
            <Kbd>Ctrl</Kbd>
            <span>+</span>
            <Kbd>R</Kbd>
          </KbdGroup>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
