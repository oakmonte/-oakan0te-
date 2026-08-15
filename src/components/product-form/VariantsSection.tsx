import { Plus, ChevronRight } from "lucide-react";
import { TextField } from "./ui";

export function VariantsSection({
  expanded,
  onToggle,
  option1Name,
  setOption1Name,
  option1Value,
  setOption1Value,
  option2Name,
  setOption2Name,
  option2Value,
  setOption2Value,
  material,
  setMaterial,
}: {
  expanded: boolean;
  onToggle: () => void;
  option1Name: string;
  setOption1Name: (v: string) => void;
  option1Value: string;
  setOption1Value: (v: string) => void;
  option2Name: string;
  setOption2Name: (v: string) => void;
  option2Value: string;
  setOption2Value: (v: string) => void;
  material: string;
  setMaterial: (v: string) => void;
}) {
  return (
    <div className="border-b-8 border-gray-50">
      <p className="px-4 pt-4 text-[15px] font-semibold text-gray-900">Variants</p>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4"
      >
        <span className="flex items-center gap-3 text-[15px] text-gray-500">
          <Plus size={18} className="text-gray-400" />
          Add options (color, size, etc.)
        </span>
        <ChevronRight size={16} className="text-gray-300" />
      </button>
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <TextField label="Option 1 name" value={option1Name} onChange={setOption1Name} placeholder="Size" />
          <TextField label="Option 1 value" value={option1Value} onChange={setOption1Value} placeholder="M" />
          <TextField label="Option 2 name" value={option2Name} onChange={setOption2Name} placeholder="Color" />
          <TextField label="Option 2 value" value={option2Value} onChange={setOption2Value} placeholder="Black" />
          <div className="col-span-2">
            <TextField label="Material" value={material} onChange={setMaterial} />
          </div>
        </div>
      )}
    </div>
  );
}