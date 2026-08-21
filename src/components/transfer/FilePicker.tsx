import type React from "react";
import { useState } from "react";
import type { SendingFile } from "../../hooks/usePeer";

interface FilePickerProps {
  onSend: (file: File) => Promise<void>;
  sendingFiles: SendingFile[];
}

export function FilePicker({ onSend, sendingFiles }: FilePickerProps) {
  const [file, setFile] = useState<File[]>([]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files?.length) return;

    setFile(Array.from(files));
  };

  const handleSend = async () => {
    if (!file.length) return;

    for (const selectedFile of file) {
      try {
        await onSend(selectedFile);
      } catch {
        break;
      }
    }
  };

  return (
    <div>
      <input type="file" multiple onChange={handleChange} />

      {file.length > 0 && (
        <div>
          {file.map((selectedFile) => (
            <div key={`${selectedFile.name}-${selectedFile.lastModified}`}>
              <p>File: {selectedFile.name}</p>
              <p>Size: {selectedFile.size} bytes</p>
            </div>
          ))}

          {sendingFiles.length > 0 && (
            <div className="mt-4 space-y-3">
              {sendingFiles.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{item.name}</span>

                    <span>
                      {item.status === "queued" && "Waiting"}
                      {item.status === "sending" && `${item.progress}%`}
                      {item.status === "completed" && "✓ Complete"}
                      {item.status === "failed" && "✕ Failed"}
                    </span>
                  </div>

                  <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${item.progress}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="bg-blue-700 p-4 rounded-md" onClick={handleSend}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
