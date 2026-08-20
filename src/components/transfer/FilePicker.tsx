import type React from "react";
import { useState } from "react";

interface FilePickerProps {
  onSend: (file: File) => void;
}

export function FilePicker({ onSend }: FilePickerProps) {
  const [file, setFile] = useState<File[]>([]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files?.length) return;

    setFile(Array.from(files));
  };

  const handleSend = () => {
    if (!file.length) return;

    file.forEach((selectedFile) => onSend(selectedFile));
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

          <button className="bg-blue-700 p-4 rounded-md" onClick={handleSend}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}
