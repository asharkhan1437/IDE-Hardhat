import { Button } from "@/components/ui/button";
import {
  Play,
  Share2,
  Download,
  Settings,
  GitFork,
  Square,
  Github,
  Upload,
  Wallet,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Search
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopBarProps {
  projectName: string;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onDownload: () => void;
  onSettingsOpen: () => void;
  onFork: () => void;
  onPull: () => void;      // New Prop
  onCommit: () => void;
  onAudit: () => void;     // New Prop
  saveStatus: string;      // New Prop for visual feedback
  // --- WEB3 PROPS ---
  walletAddress: string | null;
  onConnectWallet: () => void;
}

export default function TopBar({
  projectName,
  isRunning,
  onRun,
  onStop,
  onDownload,
  onSettingsOpen,
  onFork,
  onPull,
  onCommit,
  onAudit,
  saveStatus,
  walletAddress,
  onConnectWallet,
}: TopBarProps) {
  
  const handleShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="h-12 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-4 select-none">
      {/* LEFT SECTION: Project Info & GitHub Menu */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 bg-[#007ACC] rounded flex items-center justify-center font-bold text-white text-xs group-hover:bg-[#005a9e] transition-colors">
            ZI
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-[13px] text-[#CCCCCC] leading-tight">
              {projectName}
            </span>
            <span className="text-[10px] text-[#858585] leading-tight flex items-center gap-1">
              {saveStatus === "saving" ? (
                <span className="text-blue-400 animate-pulse">Saving...</span>
              ) : (
                <>
                   <ShieldCheck className="w-2.5 h-2.5 text-blue-500" />
                   v1.0.0
                </>
              )}
            </span>
          </div>
        </div>

        <div className="h-6 w-[1px] bg-[#3E3E42] mx-2" />

        {/* GITHUB CONTROL CENTER */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#CCCCCC] hover:bg-[#333333] h-8 gap-2 border border-[#3E3E42] px-3 transition-all"
            >
              <Github className="w-4 h-4" />
              <span className="hidden md:inline text-xs">Source Control</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[#252526] border-[#3E3E42] text-[#CCCCCC]">
            <DropdownMenuLabel>Git Actions</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#3E3E42]" />
            <DropdownMenuItem onClick={onCommit} className="gap-2 focus:bg-[#094771] focus:text-white cursor-pointer">
              <Upload className="w-4 h-4 text-blue-400" /> Push to GitHub
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPull} className="gap-2 focus:bg-[#094771] focus:text-white cursor-pointer">
              <RefreshCw className="w-4 h-4 text-green-400" /> Pull (Sync) Changes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFork} className="gap-2 focus:bg-[#094771] focus:text-white cursor-pointer border-t border-[#3E3E42] mt-1">
              <GitFork className="w-4 h-4 text-purple-400" /> Fork Repository
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ZICON SENTINEL (AUDIT) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onAudit}
          className="text-[#CCCCCC] hover:bg-[#333333] h-8 gap-2 border border-[#3E3E42] px-3 transition-all text-xs"
        >
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          Audit
        </Button>
      </div>

      {/* RIGHT SECTION: Execution & Tools */}
      <div className="flex items-center gap-1">
        {/* WALLET CONNECT BUTTON */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onConnectWallet}
          className={`h-8 gap-2 mr-2 border transition-all ${
            walletAddress 
              ? "border-green-900/50 bg-green-950/20 text-green-400 hover:bg-green-900/30" 
              : "border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/10"
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">
            {walletAddress 
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` 
              : "Connect Wallet"}
          </span>
        </Button>

        <div className="h-4 w-[1px] bg-[#3E3E42] mx-1" />

        {isRunning ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStop}
            className="text-[#F44747] hover:bg-[#333333] h-8 gap-1.5 px-3"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRun}
            className="text-[#4EC9B0] hover:bg-[#333333] h-8 gap-1.5 px-3"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run
          </Button>
        )}

        <div className="h-4 w-[1px] bg-[#3E3E42] mx-1" />

        <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" onClick={handleShare} className="text-[#CCCCCC] hover:bg-[#333333] h-8 px-2" title="Share Project">
              <Share2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDownload} className="text-[#CCCCCC] hover:bg-[#333333] h-8 px-2" title="Download ZIP">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onSettingsOpen} className="text-[#CCCCCC] hover:bg-[#333333] h-8 px-2" title="Settings">
              <Settings className="w-4 h-4" />
            </Button>
        </div>
      </div>
    </div>
  );
}