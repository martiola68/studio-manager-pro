import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SimulazioneInvioProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function SimulazioneInvio({
  value,
  onChange,
}: SimulazioneInvioProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-yellow-50 p-3">
      <Checkbox
        id="simulazioneInvio"
        checked={value}
        onCheckedChange={(checked) => onChange(!!checked)}
      />

      <Label
        htmlFor="simulazioneInvio"
        className="cursor-pointer"
      >
        Modalità simulazione: non inviare email reali
      </Label>
    </div>
  );
}
