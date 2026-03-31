import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input"; // Ensure you have this shadcn component
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, ShieldCheck, ShieldAlert } from "lucide-react";

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  theme: "dark" | "light";
  githubToken?: string; // Added for Git Push
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
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  // Check if your Node.js server is running
  useEffect(() => {
    if (open) {
      fetch("http://localhost:5000/")
        .then(() => setBackendStatus("online"))
        .catch(() => setBackendStatus("offline"));
    }
  }, [open]);

  const update = (partial: Partial<EditorSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#252526] border-[#3E3E42] text-[#CCCCCC] max-w-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            IDE Settings
            {backendStatus === "online" ? (
              <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full border border-green-800 flex items-center gap-1">
                <ShieldCheck size={10} /> Backend Online
              </span>
            ) : (
              <span className="text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full border border-red-800 flex items-center gap-1">
                <ShieldAlert size={10} /> Backend Offline
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
          
          {/* GitHub Configuration Section */}
          <div className="space-y-3 pb-4 border-b border-[#3E3E42]">
            <Label className="text-[#007ACC] font-bold text-xs uppercase tracking-wider">GitHub Integration</Label>
            <div className="space-y-2">
              <Label className="text-[#CCCCCC] text-xs">Personal Access Token (PAT)</Label>
              <Input 
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={settings.githubToken || ""}
                onChange={(e) => update({ githubToken: e.target.value })}
                className="bg-[#1E1E1E] border-[#3E3E42] text-white h-8 text-xs focus:ring-[#007ACC]"
              />
              <p className="text-[10px] text-[#858585]">
                Required for the "Push to GitHub" feature. Tokens are stored locally in your session.
              </p>
            </div>
          </div>

          {/* Editor Preferences */}
          <div className="space-y-4">
             <Label className="text-[#007ACC] font-bold text-xs uppercase tracking-wider">Editor Appearance</Label>

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
                <SelectTrigger className="bg-[#1E1E1E] border-[#3E3E42] text-[#CCCCCC] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#252526] border-[#3E3E42]">
                  <SelectItem value="2" className="text-[#CCCCCC]">2 spaces</SelectItem>
                  <SelectItem value="4" className="text-[#CCCCCC]">4 spaces</SelectItem>
                  <SelectItem value="8" className="text-[#CCCCCC]">8 spaces</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggles Group */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-[#CCCCCC]">Word Wrap</Label>
                <Switch
                  checked={settings.wordWrap}
                  onCheckedChange={(v) => update({ wordWrap: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-[#CCCCCC]">Line Numbers</Label>
                <Switch
                  checked={settings.lineNumbers}
                  onCheckedChange={(v) => update({ lineNumbers: v })}
                />
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label className="text-[#CCCCCC]">Color Theme</Label>
              <Select
                value={settings.theme}
                onValueChange={(v) => update({ theme: v as "dark" | "light" })}
              >
                <SelectTrigger className="bg-[#1E1E1E] border-[#3E3E42] text-[#CCCCCC] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#252526] border-[#3E3E42]">
                  <SelectItem value="dark" className="text-[#CCCCCC]">VS Dark Modern</SelectItem>
                  <SelectItem value="light" className="text-[#CCCCCC]">VS Light Modern</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}