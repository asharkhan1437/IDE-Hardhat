import { Button } from "@/components/ui/button";
import {
  Play,
  Share2,
  Download,
  Settings,
  GitFork,
  Square,
  Wallet,
  Github,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  UploadCloud,
  ChevronDown,
  LogOut,
  Hammer,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface TopBarProps {
  projectName: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  onDownload: () => void;
  onSettingsOpen: () => void;
  onFork: () => void;
  onCommit: () => void;
  onOpenFolder: () => void;
  onAudit?: () => void;
  walletAddress: string | null;
  onConnectWallet: () => void;
  isAuthenticated?: boolean;
  onLogin?: () => void;
  // ── THE FIX IS HERE ──
  onCompile?: any;
  isHardhatActive?: boolean;   // Added '?' here too for safety
}

export default function TopBar({
  projectName,
  saveStatus,
  isRunning,
  onRun,
  onStop,
  onDownload,
  onSettingsOpen,
  onFork,
  onCommit,
  onOpenFolder,
  onAudit,
  walletAddress,
  onConnectWallet,
  isAuthenticated = false,
  onLogin = () => {},
  onCompile,
  isHardhatActive,
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

  const cleanButtonStyle = { textDecoration: 'none' };

  return (
    <div className="h-12 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-4 select-none">
      
      {/* LEFT SECTION */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#007ACC] rounded flex items-center justify-center font-bold text-white text-xs shadow-lg">
            ZI
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-[#CCCCCC] leading-none mb-1">
              {projectName}
            </span>
            <div className="h-3 flex items-center">
              {saveStatus === "saving" && (
                <span className="text-[10px] text-yellow-500 flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Syncing...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-[10px] text-[#4EC9B0] flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Cloud Synced
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-[10px] text-[#F44747] flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> Sync Error
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFolder}
            style={cleanButtonStyle}
            className="text-[#CCCCCC] hover:bg-[#333333] h-8 gap-2 px-3 text-xs border border-[#3E3E42]"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Open Local</span>
          </Button>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center gap-1">
        
        {/* --- DYNAMIC COMPILE BUTTON --- */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCompile}
          disabled={!isHardhatActive}
          style={cleanButtonStyle}
          className={`h-8 gap-1.5 text-xs px-3 transition-all ${
            isHardhatActive 
              ? "text-orange-400 hover:bg-orange-500/10 border border-orange-500/20" 
              : "text-gray-600 opacity-40 grayscale cursor-not-allowed"
          }`}
          title={isHardhatActive ? "Compile Contracts (Hardhat)" : "Install Hardhat from Marketplace"}
        >
          <Hammer className={`w-3.5 h-3.5 ${isHardhatActive ? "animate-pulse" : ""}`} />
          <span>Compile</span>
        </Button>

        <div className="w-[1px] h-4 bg-[#3E3E42] mx-2" />
        
        {/* Run / Stop Controls */}
        {isRunning ? (
          <Button variant="ghost" size="sm" onClick={onStop} className="text-[#F44747] hover:bg-[#333333] h-8 gap-1 text-xs">
            <Square className="w-3.5 h-3.5" />
            <span>Stop App</span>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onRun} className="text-[#4EC9B0] hover:bg-[#333333] h-8 gap-1 text-xs">
            <Play className="w-3.5 h-3.5" />
            <span>Run App</span>
          </Button>
        )}

        <div className="w-[1px] h-4 bg-[#3E3E42] mx-2" />

        {/* GitHub Section */}
        {!isAuthenticated ? (
          <Button variant="ghost" size="sm" onClick={onLogin} className="text-white bg-[#24292e] hover:bg-[#2f363d] h-8 gap-2 px-3 text-xs border border-[#444d56]">
            <Github className="w-3.5 h-3.5" />
            <span>Connect GitHub</span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-[#4EC9B0] bg-[#1e2927] hover:bg-[#253330] h-8 gap-2 px-3 text-xs border border-[#4EC9B0]/30">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4EC9B0] animate-pulse" />
                <span>Connected</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#252526] border-[#3E3E42] text-[#CCCCCC]">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase text-gray-500 px-2 py-1.5">Version Control</DropdownMenuLabel>
              <DropdownMenuItem onClick={onCommit} className="gap-2 cursor-pointer">
                <UploadCloud className="w-4 h-4 text-blue-400" />
                <span>Push Changes</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onFork} className="gap-2 cursor-pointer">
                <GitFork className="w-4 h-4 text-purple-400" />
                <span>Fork to Carbon</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3E3E42]" />
              <DropdownMenuItem onClick={() => window.location.reload()} className="gap-2 cursor-pointer text-red-400">
                <LogOut className="w-4 h-4" />
                <span>Disconnect</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="w-[1px] h-4 bg-[#3E3E42] mx-2" />

        {/* Audit Button (Only if Wallet Connected) */}
        {walletAddress && onAudit && (
          <Button variant="ghost" size="sm" onClick={onAudit} className="text-[#9CDCFE] hover:bg-[#333333] h-8 gap-1 text-xs">
            Audit
          </Button>
        )}

        {/* Action Icons */}
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onDownload} className="text-[#CCCCCC] h-8 w-8" title="Export ZIP">
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleShare} className="text-[#CCCCCC] h-8 w-8" title="Share">
            <Share2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onSettingsOpen} className="text-[#CCCCCC] h-8 w-8" title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Web3 Wallet */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onConnectWallet}
          className={`h-8 gap-2 px-3 ml-2 text-xs border ${
            walletAddress ? "text-[#4EC9B0] bg-[#1e2927] border-[#4EC9B0]/30" : "text-[#CCCCCC] border-[#3E3E42]"
          } hover:bg-[#333333]`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>{walletAddress ? `${walletAddress.slice(0, 6)}...` : "Wallet"}</span>
        </Button>
      </div>
    </div>
  );
}