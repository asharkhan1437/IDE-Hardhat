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
  LogOut,
  AlertTriangle,
  Hammer,
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
  onPull: () => void;
  onCommit: () => void;
  onAudit: () => void;
  onCompile?: () => void;
  onDeploy?: (network: "sepolia" | "local") => void;
  isHardhatActive?: boolean;
  onPatSave?: (token: string) => void;
  saveStatus: string;
  // GitHub auth status
  isAuthenticated?: boolean;
  onLogin?: () => void;
  // Web3
  walletAddress: string | null;
  walletBalance: string | null;
  isWrongNetwork: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onSwitchNetwork: () => void;
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
  onCompile,
  onDeploy,
  isHardhatActive,
  onPatSave,
  saveStatus,
  isAuthenticated,
  onLogin,
  walletAddress,
  walletBalance,
  isWrongNetwork,
  onConnectWallet,
  onDisconnectWallet,
  onSwitchNetwork,
}: TopBarProps) {
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="h-12 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-4 select-none">
      {/* LEFT */}
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

        {/* GITHUB CONNECT STATUS */}
        {onLogin && (
          isAuthenticated ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogin}
              title="Click to disconnect GitHub"
              className="h-8 gap-1.5 border border-green-900/50 bg-green-950/20 text-green-400 hover:bg-red-950/30 hover:text-red-400 hover:border-red-900/50 transition-all text-xs"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <Github className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Connected</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogin}
              title="Connect with GitHub (OAuth)"
              className="h-8 gap-1.5 border border-[#3E3E42] text-[#858585] hover:bg-[#333333] hover:text-white transition-all text-xs"
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Connect GitHub</span>
            </Button>
          )
        )}

        {/* GITHUB */}
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
          <DropdownMenuContent className="w-64 bg-[#252526] border-[#3E3E42] text-[#CCCCCC]">
            <DropdownMenuLabel className="text-[#858585] text-[10px] uppercase tracking-wider">
              Source Control
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#3E3E42]" />
            <DropdownMenuItem onClick={onCommit} className="gap-2 focus:bg-[#094771] focus:text-white cursor-pointer">
              <Upload className="w-4 h-4 text-blue-400" /> Push to GitHub
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPull} className="gap-2 focus:bg-[#094771] focus:text-white cursor-pointer">
              <RefreshCw className="w-4 h-4 text-green-400" /> Pull Changes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFork} className="gap-2 focus:bg-[#094771] focus:text-white cursor-pointer border-t border-[#3E3E42] mt-1">
              <GitFork className="w-4 h-4 text-purple-400" /> Fork Repository
            </DropdownMenuItem>
            {/* PAT fallback — for users who prefer token over OAuth */}
            <DropdownMenuSeparator className="bg-[#3E3E42]" />
            <div className="px-2 py-2">
              <p className="text-[9px] text-[#555] mb-1.5 uppercase tracking-wider">Or use a Personal Access Token</p>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                defaultValue=""
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) onPatSave?.(val);
                  }
                }}
                className="w-full bg-[#1e1e1e] border border-[#3E3E42] focus:border-[#007ACC] rounded px-2 py-1 text-[11px] text-white outline-none font-mono"
              />
              <p className="text-[9px] text-[#444] mt-1">Press Enter to save · needs repo scope</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AUDIT */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onAudit}
          className="text-[#CCCCCC] hover:bg-[#333333] h-8 gap-2 border border-[#3E3E42] px-3 transition-all text-xs"
        >
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          Audit
        </Button>

        {/* COMPILE */}
        {isHardhatActive && onCompile && (
          <Button variant="ghost" size="sm" onClick={onCompile}
            className="text-[#CCCCCC] hover:bg-[#333333] h-8 gap-2 border border-[#FFF100]/40 px-3 transition-all text-xs"
            title="Compile Solidity contracts">
            <Hammer className="w-4 h-4 text-[#FFF100]" />
            Compile
          </Button>
        )}

        {/* DEPLOY dropdown */}
        {isHardhatActive && onDeploy && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm"
                className="text-[#CCCCCC] hover:bg-[#333333] h-8 gap-2 border border-purple-500/40 px-3 transition-all text-xs">
                <Upload className="w-4 h-4 text-purple-400" />
                Deploy
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#252526] border-[#3E3E42] text-[#CCCCCC] w-52">
              <DropdownMenuLabel className="text-[10px] text-[#555] uppercase tracking-wider">Deploy Contract</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#3E3E42]" />
              <DropdownMenuItem onClick={() => onDeploy("local")} className="gap-2 focus:bg-[#094771] cursor-pointer">
                <span className="text-yellow-400">⛏</span>
                <div>
                  <p className="text-xs">Hardhat Node (Local)</p>
                  <p className="text-[10px] text-[#555]">localhost:8545 · free · instant</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDeploy("sepolia")} className="gap-2 focus:bg-[#094771] cursor-pointer">
                <span className="text-purple-400">🔷</span>
                <div>
                  <p className="text-xs">Sepolia Testnet</p>
                  <p className="text-[10px] text-[#555]">via MetaMask · needs test ETH</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-1">
        {/* WALLET — wrong network warning */}
        {walletAddress && isWrongNetwork && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSwitchNetwork}
            className="h-8 gap-1.5 mr-1 border border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Switch to Sepolia
          </Button>
        )}

        {/* WALLET BUTTON */}
        {walletAddress ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 mr-2 border border-green-900/50 bg-green-950/20 text-green-400 hover:bg-green-900/30 transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <Wallet className="w-3.5 h-3.5" />
                <span className="text-xs font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                {walletBalance && (
                  <span className="text-[10px] text-green-600 font-mono border-l border-green-900/50 pl-2">
                    {walletBalance} ETH
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#252526] border-[#3E3E42] text-[#CCCCCC] w-52">
              <DropdownMenuLabel className="text-[10px] text-[#555] font-mono">
                {walletAddress}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#3E3E42]" />
              <DropdownMenuItem className="text-[11px] gap-2 focus:bg-[#094771] focus:text-white cursor-default">
                Network: <span className="text-green-400">Sepolia</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[11px] gap-2 focus:bg-[#094771] focus:text-white cursor-default">
                Balance: <span className="text-[#4EC9B0] font-mono">{walletBalance} ETH</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#3E3E42]" />
              <DropdownMenuItem
                onClick={onDisconnectWallet}
                className="text-[11px] gap-2 text-red-400 focus:bg-red-950/30 focus:text-red-300 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onConnectWallet}
            className="h-8 gap-2 mr-2 border border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span className="text-xs font-mono">Connect Wallet</span>
          </Button>
        )}

        <div className="h-4 w-[1px] bg-[#3E3E42] mx-1" />

        {isRunning ? (
          <Button variant="ghost" size="sm" onClick={onStop} className="text-[#F44747] hover:bg-[#333333] h-8 gap-1.5 px-3">
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onRun} className="text-[#4EC9B0] hover:bg-[#333333] h-8 gap-1.5 px-3">
            <Play className="w-3.5 h-3.5 fill-current" />
            Run
          </Button>
        )}

        <div className="h-4 w-[1px] bg-[#3E3E42] mx-1" />

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" onClick={handleShare} className="text-[#CCCCCC] hover:bg-[#333333] h-8 px-2" title="Share">
            <Share2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDownload} className="text-[#CCCCCC] hover:bg-[#333333] h-8 px-2" title="Download">
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
