import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleAlert,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { TransferProgressProps, TransferState } from "@/types/orbit";

function TransferItem({
  transfer,
  direction,
}: {
  transfer: TransferState;
  direction: "send" | "receive";
}) {
  const isSending = direction === "send";
  const isComplete = transfer.status === "completed";
  const isFailed = transfer.status === "failed";
  const progress = Math.min(100, Math.max(0, transfer.progress));
  const color = isFailed
    ? "text-rose-400"
    : isComplete
      ? "text-emerald-400"
      : isSending
        ? "text-sky-400"
        : "text-violet-400";
  const barColor = isFailed
    ? "bg-rose-400"
    : isComplete
      ? "bg-emerald-400"
      : isSending
        ? "bg-sky-400"
        : "bg-violet-400";
  const StatusIcon = isFailed
    ? CircleAlert
    : isComplete
      ? CheckCircle2
      : LoaderCircle;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/50 p-3.5">
      <div className="flex items-start gap-3">
        <div className={`rounded-xl bg-slate-900 p-2 ${color}`}>
          {isSending ? (
            <ArrowUpFromLine size={17} />
          ) : (
            <ArrowDownToLine size={17} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {isSending ? "Sending" : "Receiving"}
            </span>
            <StatusIcon
              size={16}
              className={`${color} ${!isComplete && !isFailed ? "animate-spin" : ""}`}
            />
          </div>
          <div className="mt-1 flex items-center gap-2">
            <FileText size={14} className="shrink-0 text-slate-500" />
            <p
              className="truncate text-sm font-medium text-slate-200"
              title={transfer.fileName}>
              {transfer.fileName}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          className={`w-10 text-right text-xs font-bold tabular-nums ${color}`}>
          {Math.round(progress)}%
        </span>
      </div>

      {(isComplete || isFailed) && (
        <p className={`mt-2 truncate text-[11px] ${color}`}>
          {isComplete
            ? "Transfer complete"
            : transfer.error || "Transfer failed"}
        </p>
      )}
    </div>
  );
}

export function TransferProgress({
  sendTransfer,
  receiveTransfer,
}: TransferProgressProps) {
  if (!sendTransfer && !receiveTransfer) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/75 p-4 shadow-xl shadow-slate-950/20">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-sky-400/70 to-transparent" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            Transfer in progress
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Direct device-to-device transfer via P2P
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          P2P
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {sendTransfer && (
          <TransferItem transfer={sendTransfer} direction="send" />
        )}
        {receiveTransfer && (
          <TransferItem transfer={receiveTransfer} direction="receive" />
        )}
      </div>
    </section>
  );
}
