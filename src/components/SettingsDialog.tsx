import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  theme: "dark" | "light";
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
}

export default function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: SettingsDialogProps) {
  const update = (partial: Partial<EditorSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#252526] border-[#3E3E42] text-[#CCCCCC] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[#CCCCCC]">Font Size</Label>
              <span className="text-sm text-[#858585]">{settings.fontSize}px</span>
            </div>
            <Slider
              value={[settings.fontSize]}
              onValueChange={([v]) => update({ fontSize: v })}
              min={10}
              max={24}
              step={1}
              className="[&_[role=slider]]:bg-[#007ACC] [&_[role=slider]]:border-[#007ACC]"
            />
          </div>

          {/* Tab Size */}
          <div className="space-y-2">
            <Label className="text-[#CCCCCC]">Tab Size</Label>
            <Select
              value={String(settings.tabSize)}
              onValueChange={(v) => update({ tabSize: Number(v) })}
            >
              <SelectTrigger className="bg-[#1E1E1E] border-[#3E3E42] text-[#CCCCCC]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#252526] border-[#3E3E42]">
                <SelectItem value="2" className="text-[#CCCCCC]">2 spaces</SelectItem>
                <SelectItem value="4" className="text-[#CCCCCC]">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Word Wrap */}
          <div className="flex items-center justify-between">
            <Label className="text-[#CCCCCC]">Word Wrap</Label>
            <Switch
              checked={settings.wordWrap}
              onCheckedChange={(v) => update({ wordWrap: v })}
            />
          </div>

          {/* Line Numbers */}
          <div className="flex items-center justify-between">
            <Label className="text-[#CCCCCC]">Line Numbers</Label>
            <Switch
              checked={settings.lineNumbers}
              onCheckedChange={(v) => update({ lineNumbers: v })}
            />
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label className="text-[#CCCCCC]">Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(v) => update({ theme: v as "dark" | "light" })}
            >
              <SelectTrigger className="bg-[#1E1E1E] border-[#3E3E42] text-[#CCCCCC]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#252526] border-[#3E3E42]">
                <SelectItem value="dark" className="text-[#CCCCCC]">Dark</SelectItem>
                <SelectItem value="light" className="text-[#CCCCCC]">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}