import { type Dispatch, type SetStateAction } from "react";
import { X } from "lucide-react";

type StagedFileProps = {
  stagedFiles: File[];
  setStagedFiles: Dispatch<SetStateAction<File[]>>;
  formatFileSize: (bytes: number) => string;
  handleRemoveStagedFile: (index: number) => void;
};

export function StagedFile({
  stagedFiles,
  setStagedFiles,
  formatFileSize,
  handleRemoveStagedFile,
}: StagedFileProps) {
  return (
    <>
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 max-h-56">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-300">
            {stagedFiles.length} file ready to send
          </p>

          <button
            onClick={() => setStagedFiles([])}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors">
            Clear all
          </button>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
          {stagedFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center justify-between gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-slate-200 truncate">{file.name}</p>

                <p className="text-[10px] text-slate-500">
                  {formatFileSize(file.size)}
                </p>
              </div>

              <button
                onClick={() => handleRemoveStagedFile(index)}
                className="shrink-0 text-slate-500 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
