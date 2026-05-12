import type { ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UploadAllegatiProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export default function UploadAllegati({
  files,
  onChange,
}: UploadAllegatiProps) {
  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files) return;

    onChange(Array.from(e.target.files));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="allegato">
        Allegati
      </Label>

      <Input
        id="allegato"
        type="file"
        multiple
        onChange={handleFileChange}
        className="cursor-pointer"
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <Badge
              key={`${file.name}-${index}`}
              variant="secondary"
            >
              {file.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
