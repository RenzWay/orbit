import { Trash2, Link2, FileText, Check, Copy, Clipboard } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export interface ClipboardHistoryItem {
  id: string;
  text: string;
  time: string;
  isUrl?: boolean;
}

interface ClipboardModalProps {
  handle: () => void;
  history: ClipboardHistoryItem[];
  onClearHistory: () => void;
}

export function ClipboardModal({
  handle,
  history,
  onClearHistory,
}: ClipboardModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000); // Reset icon centang setelah 2 detik
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          onClick={handle}
          size="lg"
          variant="secondary"
          className="rounded-xl gap-2 px-6 h-12 cursor-pointer">
          <Clipboard size={18} />
          Copy Clipboard
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Clipboard size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Clipboard History
              </DialogTitle>
              <p className="text-xs text-slate-400">
                Synced texts from your devices
              </p>
            </div>
          </div>

          {history.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearHistory}
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg h-8 w-8 transition-colors"
              title="Clear all">
              <Trash2 size={16} />
            </Button>
          )}
        </DialogHeader>

        {/* List Clipboard Items */}
        <ScrollArea className="h-72 pr-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-500 gap-2">
              <Clipboard size={36} className="opacity-30" />
              <p className="text-sm">No clipboard history yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 pt-2">
              {history.map((item: ClipboardHistoryItem) => (
                <div
                  key={item.id}
                  className="group relative flex items-start justify-between gap-3 p-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/30 rounded-xl transition-all">
                  <div className="flex gap-2.5 items-start flex-1 min-w-0">
                    <div className="mt-0.5 text-slate-400 group-hover:text-sky-400 transition-colors">
                      {item.isUrl ? (
                        <Link2 size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-mono break-all">
                        {item.text}
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {item.time}
                      </span>
                    </div>
                  </div>

                  {/* Button Copy di Tiap Baris */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopy(item.id, item.text)}
                    className="h-8 w-8 shrink-0 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all">
                    {copiedId === item.id ? (
                      <Check size={14} className="text-green-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
