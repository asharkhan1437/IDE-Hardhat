import { useState, useCallback, useEffect } from "react";
import {
  Puzzle,
  Search,
  ShieldCheck,
  Download,
  CheckCircle2,
  Lock,
  ExternalLink,
  Copy,
  X,
  Wallet,
  Tag,
  ChevronRight,
  Play,
  Square,
  Loader2,
  Terminal,
  Globe,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { EXTENSIONS, CATEGORIES, Extension } from "@/data/extensions";

interface ExtensionMarketplaceProps {
  walletAddress: string | null;
  onConnectWallet: () => void;
  onPurchase: (extensionId: string, price: string) => Promise<{ success: boolean }>;
  checkOwnership: (extensionId: string) => boolean;
  /** Sends a command into the IDE's WebContainer terminal (for runtimeType "terminal" extensions) */
  onRunInTerminal?: (command: string, instructions?: string) => void;
}

export default function ExtensionMarketplace({
  walletAddress,
  onConnectWallet,
  onPurchase,
  checkOwnership,
  onRunInTerminal,
}: ExtensionMarketplaceProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedExt, setSelectedExt] = useState<Extension | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<Record<string, "running" | "stopped" | "starting">>({});
  const [ownedSet, setOwnedSet] = useState<Set<string>>(() => {
    const stored = JSON.parse(localStorage.getItem("zicon-owned-extensions") || "[]");
    return new Set(stored);
  });

  // Poll status of all owned DOCKER extensions only
  useEffect(() => {
    const checkStatuses = async () => {
      const owned = JSON.parse(localStorage.getItem("zicon-owned-extensions") || "[]");
      for (const id of owned) {
        const ext = EXTENSIONS.find((e) => e.id === id);
        // Only poll docker-based extensions — terminal/external/webcontainer have no container to check
        if (ext?.runtimeType === "terminal" || ext?.runtimeType === "external" || ext?.runtimeType === "webcontainer") continue;
        try {
          const res = await fetch(`http://localhost:5000/api/extensions/status/${id}`);
          const data = await res.json();
          setServiceStatus(prev => ({ ...prev, [id]: data.status }));
        } catch {}
      }
    };
    checkStatuses();
    const interval = setInterval(checkStatuses, 5000);
    return () => clearInterval(interval);
  }, [ownedSet]);

  const isOwned = useCallback(
    (id: string) => ownedSet.has(id) || checkOwnership(id),
    [ownedSet, checkOwnership]
  );

  const filtered = EXTENSIONS.filter((ext) => {
    const matchCat = activeCategory === "all" || ext.category === activeCategory;
    const matchSearch =
      !search ||
      ext.name.toLowerCase().includes(search.toLowerCase()) ||
      ext.tags.some((t) => t.includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleBuy = async (ext: Extension, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletAddress) {
      toast.error("Connect your MetaMask wallet first.", {
        action: { label: "Connect", onClick: onConnectWallet },
      });
      return;
    }
    setPurchasing(ext.id);
    const result = await onPurchase(ext.id, ext.price);
    if (result.success) {
      const next = new Set(ownedSet);
      next.add(ext.id);
      setOwnedSet(next);
    }
    setPurchasing(null);
  };

  const handleLaunch = async (ext: Extension) => {
    setLaunching(ext.id);
    setServiceStatus(prev => ({ ...prev, [ext.id]: "starting" }));
    try {
      const res = await fetch(`http://localhost:5000/api/extensions/launch/${ext.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        // Keep as starting — polling will flip it to running once container is up
        toast.success(`${ext.name} is starting!`, {
          description: `Will be available at: ${data.url}`,
          action: {
            label: "Open",
            onClick: () => window.open(data.url, "_blank"),
          },
          duration: 10000,
        });
      } else {
        setServiceStatus(prev => ({ ...prev, [ext.id]: "stopped" }));
        toast.error(`Failed to launch ${ext.name}`);
      }
    } catch {
      setServiceStatus(prev => ({ ...prev, [ext.id]: "stopped" }));
      toast.error("Backend unreachable. Is server.js running?");
    }
    setLaunching(null);
  };

  // Handle "terminal" and "webcontainer" types — send a command into the WebContainer terminal
  const handleTerminalLaunch = (ext: Extension) => {
    const command = ext.webcontainerCommand || ext.terminalCommand;
    if (!command) return;
    if (!onRunInTerminal) {
      toast.error("Terminal not available.");
      return;
    }
    const instructions = ext.runtimeType === "webcontainer"
      ? `Running ${ext.name} directly in your IDE — check the Preview panel for the live URL once it starts.`
      : ext.terminalInstructions;
    onRunInTerminal(command, instructions);
  };

  // Handle "external" type — open the tool's site/download page
  const handleExternalLaunch = (ext: Extension) => {
    if (!ext.externalUrl) return;
    window.open(ext.externalUrl, "_blank");
    toast.success(`Opening ${ext.name}...`, {
      description: ext.externalUrl,
    });
  };

  const handleStop = async (ext: Extension) => {
    try {
      await fetch(`http://localhost:5000/api/extensions/stop/${ext.id}`, { method: "POST" });
      setServiceStatus(prev => ({ ...prev, [ext.id]: "stopped" }));
      toast.info(`${ext.name} stopped.`);
    } catch {
      toast.error("Failed to stop service.");
    }
  };

  const copySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    toast.success("Compose snippet copied!");
  };

  const categoryColor: Record<string, string> = {
    devops: "#24A1C1",
    frontend: "#61DAFB",
    backend: "#009639",
    database: "#336791",
    web3: "#F6851B",
    container: "#13BEF9",
    ai: "#D97757",
    cms: "#21759B",
    messaging: "#FF6600",
    storage: "#C72E49",
    network: "#88171A",
  };

  const getPort = (id: string) => {
    const ports: Record<string, string> = {
      portainer: "9000", nginx: "8080", "react-app": "5173",
      nextjs: "3002", postgres: "5050", redis: "8083",
      mysql: "8085", mariadb: "8087", mssql: "8099",
      traefik: "8082", grafana: "3001",
      prometheus: "9090", mongodb: "8081", elasticsearch: "5601",
      influxdb: "8086", rabbitmq: "15672", kafka: "9092",
      minio: "9003", gitea: "3003", jenkins: "8084",
      sonarqube: "9001", "flask-redis": "5001",
      "django-postgres": "8000", hardhat: "8545", "web3-auth": "4000",
      tomcat: "8100", httpd: "8101", jboss: "8102",
    };
    return ports[id] || "3000";
  };

  return (
    <div className="flex h-full bg-[#1e1e1e] text-[#CCCCCC] font-mono overflow-hidden">
      {/* LEFT PANEL */}
      <div className="w-72 border-r border-[#3E3E42] flex flex-col bg-[#252526]">
        {/* Header */}
        <div className="p-4 border-b border-[#3E3E42]">
          <div className="flex items-center gap-2 mb-3">
            <Puzzle className="w-5 h-5 text-[#007ACC]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">
              Extension Store
            </h2>
          </div>

          {/* Wallet bar */}
          {walletAddress ? (
            <div className="flex items-center gap-2 bg-green-950/30 border border-green-900/40 rounded px-2 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400 font-mono">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
              </span>
              <span className="ml-auto text-[9px] text-green-600">Sepolia</span>
            </div>
          ) : (
            <button
              onClick={onConnectWallet}
              className="w-full flex items-center justify-center gap-2 bg-[#007ACC]/10 hover:bg-[#007ACC]/20 border border-[#007ACC]/30 rounded px-3 py-1.5 text-[11px] text-[#007ACC] transition-all"
            >
              <Wallet className="w-3.5 h-3.5" />
              Connect MetaMask to Buy
            </button>
          )}

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#858585]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search extensions..."
              className="w-full bg-[#1e1e1e] border border-[#3E3E42] rounded pl-7 pr-3 py-1.5 text-xs outline-none focus:border-[#007ACC] text-[#CCCCCC] placeholder:text-[#555]"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="p-2 border-b border-[#3E3E42]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full text-left px-3 py-1.5 rounded text-[11px] flex items-center justify-between transition-colors ${
                activeCategory === cat.id
                  ? "bg-[#094771] text-white"
                  : "text-[#858585] hover:text-[#CCCCCC] hover:bg-[#2A2D2E]"
              }`}
            >
              <span>{cat.label}</span>
              {activeCategory === cat.id && (
                <ChevronRight className="w-3 h-3 opacity-50" />
              )}
            </button>
          ))}
        </div>

        {/* Extension list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((ext) => {
            const owned = isOwned(ext.id);
            const buying = purchasing === ext.id;
            return (
              <button
                key={ext.id}
                onClick={() => setSelectedExt(ext)}
                className={`w-full text-left p-2.5 rounded border transition-all ${
                  selectedExt?.id === ext.id
                    ? "border-[#007ACC] bg-[#094771]/30"
                    : "border-[#3E3E42] bg-[#1e1e1e] hover:border-[#555] hover:bg-[#2A2D2E]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{ext.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white truncate">
                        {ext.name}
                      </span>
                      {owned ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <span className="text-[9px] text-[#4EC9B0] font-mono shrink-0">
                          {ext.price} ETH
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-[#555] truncate mt-0.5">
                      {ext.description.slice(0, 50)}...
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL — Detail */}
      {selectedExt ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Detail header */}
          <div
            className="p-6 border-b border-[#3E3E42]"
            style={{
              background: `linear-gradient(135deg, ${selectedExt.color}15, transparent)`,
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl border"
                  style={{
                    borderColor: selectedExt.color + "40",
                    background: selectedExt.color + "15",
                  }}
                >
                  {selectedExt.icon}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    {selectedExt.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full border font-mono uppercase"
                      style={{
                        color: categoryColor[selectedExt.category] || "#888",
                        borderColor:
                          (categoryColor[selectedExt.category] || "#888") + "40",
                        background:
                          (categoryColor[selectedExt.category] || "#888") + "15",
                      }}
                    >
                      {selectedExt.category}
                    </span>
                    {selectedExt.dockerImage && (
                      <span className="text-[10px] text-[#555] font-mono">
                        🐋 {selectedExt.dockerImage}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedExt(null)}
                className="text-[#555] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Price + Buy + Launch */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {isOwned(selectedExt.id) ? (
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Owned badge */}
                  <div className="flex items-center gap-2 bg-green-950/30 border border-green-900/40 rounded-lg px-3 py-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400 font-semibold">Installed</span>
                  </div>

                  {/* ── WEBCONTAINER TYPE — Hardhat etc. ── */}
                  {selectedExt.runtimeType === "webcontainer" ? (
                    <button
                      onClick={() => handleTerminalLaunch(selectedExt)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-600 hover:bg-yellow-500 text-black transition-all active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Run in IDE (No Docker)
                    </button>

                  /* ── TERMINAL TYPE — Claude Code etc. ── */
                  ) : selectedExt.runtimeType === "terminal" ? (
                    <button
                      onClick={() => handleTerminalLaunch(selectedExt)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#D97757] hover:bg-[#c2664a] text-white transition-all active:scale-95"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Install in Terminal
                    </button>

                  /* ── EXTERNAL TYPE — Cursor, NotebookLM ── */
                  ) : selectedExt.runtimeType === "external" ? (
                    <button
                      onClick={() => handleExternalLaunch(selectedExt)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#007ACC] hover:bg-[#005a9e] text-white transition-all active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open {selectedExt.name}
                    </button>

                  /* ── DOCKER TYPE — default, existing behaviour ── */
                  ) : serviceStatus[selectedExt.id] === "running" ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Running
                      </div>
                      <button
                        onClick={() => handleStop(selectedExt)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/30 border border-red-900/40 text-red-400 hover:bg-red-900/30 transition-all"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        Stop
                      </button>
                      {EXTENSIONS.find(e => e.id === selectedExt.id) && (
                        <a
                          href={`http://localhost:${getPort(selectedExt.id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-[#007ACC] hover:underline"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ) : serviceStatus[selectedExt.id] === "starting" || launching === selectedExt.id ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Starting container...
                    </div>
                  ) : (
                    <button
                      onClick={() => handleLaunch(selectedExt)}
                      disabled={launching === selectedExt.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-700 hover:bg-green-600 text-white transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Launch
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#4EC9B0]" />
                    <span className="text-lg font-bold text-[#4EC9B0] font-mono">
                      {selectedExt.price} ETH
                    </span>
                    <span className="text-[10px] text-[#555]">Sepolia</span>
                  </div>
                  <button
                    onClick={(e) => handleBuy(selectedExt, e)}
                    disabled={!!purchasing}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      purchasing === selectedExt.id
                        ? "bg-[#007ACC]/50 text-white/50 cursor-wait"
                        : "bg-[#007ACC] hover:bg-[#005a9e] text-white active:scale-95"
                    }`}
                  >
                    {purchasing === selectedExt.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Confirm in MetaMask...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Buy & Install
                      </>
                    )}
                  </button>
                  {!walletAddress && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#858585]">
                      <Lock className="w-3 h-3" />
                      Wallet required
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Description + Compose */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#858585] mb-2">
                Description
              </h3>
              <p className="text-sm text-[#CCCCCC] leading-relaxed">
                {selectedExt.description}
              </p>
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#858585] mb-2">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedExt.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] bg-[#2A2D2E] border border-[#3E3E42] text-[#858585] px-2 py-0.5 rounded font-mono"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* How it works — webcontainer type */}
            {selectedExt.runtimeType === "webcontainer" && (
              <div className="bg-[#252526] border border-yellow-600/30 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#858585] mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                  How this works
                </h3>
                <p className="text-sm text-[#CCCCCC] leading-relaxed mb-2">
                  This runs <span className="text-yellow-400 font-semibold">natively in your IDE's WebContainer</span> — no Docker, no image pulls, operates directly on your project files.
                </p>
                <p className="text-sm text-[#CCCCCC] leading-relaxed">
                  Clicking <span className="text-yellow-400 font-semibold">"Run in IDE"</span> sends this command to your terminal:
                </p>
                <pre className="bg-[#1e1e1e] border border-[#3E3E42] rounded p-3 text-[11px] text-[#9CDCFE] font-mono mt-2 overflow-x-auto">
                  {selectedExt.webcontainerCommand}
                </pre>
                <p className="text-[10px] text-[#555] mt-2">
                  Make sure you've clicked <span className="text-white">Run</span> at least once so the terminal is active. The Preview panel will pick up the live URL automatically.
                </p>
              </div>
            )}

            {/* How it works — terminal type */}
            {selectedExt.runtimeType === "terminal" && (
              <div className="bg-[#252526] border border-[#D97757]/30 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#858585] mb-2 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#D97757]" />
                  How this works
                </h3>
                <p className="text-sm text-[#CCCCCC] leading-relaxed mb-2">
                  This is a CLI tool, not a web service. Clicking <span className="text-[#D97757] font-semibold">"Install in Terminal"</span> sends this command to your IDE's terminal:
                </p>
                <pre className="bg-[#1e1e1e] border border-[#3E3E42] rounded p-3 text-[11px] text-[#9CDCFE] font-mono overflow-x-auto">
                  {selectedExt.terminalCommand}
                </pre>
                {selectedExt.terminalInstructions && (
                  <p className="text-[11px] text-[#858585] mt-2">
                    {selectedExt.terminalInstructions}
                  </p>
                )}
                <p className="text-[10px] text-[#555] mt-2">
                  Make sure you've clicked <span className="text-white">Run</span> at least once so the terminal is active.
                </p>
              </div>
            )}

            {/* How it works — external type */}
            {selectedExt.runtimeType === "external" && (
              <div className="bg-[#252526] border border-[#007ACC]/30 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#858585] mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#007ACC]" />
                  How this works
                </h3>
                <p className="text-sm text-[#CCCCCC] leading-relaxed mb-2">
                  {selectedExt.name} runs as a separate {selectedExt.id === "cursor-ide" ? "desktop application" : "cloud service"} — it can't run inside this browser-based IDE.
                </p>
                <p className="text-sm text-[#CCCCCC] leading-relaxed">
                  Clicking <span className="text-[#007ACC] font-semibold">"Open {selectedExt.name}"</span> opens it in a new tab at:
                </p>
                <pre className="bg-[#1e1e1e] border border-[#3E3E42] rounded p-3 text-[11px] text-[#9CDCFE] font-mono mt-2 overflow-x-auto">
                  {selectedExt.externalUrl}
                </pre>
              </div>
            )}

            {/* Compose snippet */}
            {selectedExt.composeSnippet && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#858585]">
                    docker-compose.yml Snippet
                  </h3>
                  <button
                    onClick={() => copySnippet(selectedExt.composeSnippet!)}
                    className="flex items-center gap-1 text-[10px] text-[#007ACC] hover:text-white transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <pre className="bg-[#1e1e1e] border border-[#3E3E42] rounded-lg p-4 text-[11px] text-[#9CDCFE] overflow-x-auto leading-relaxed font-mono">
                  {selectedExt.composeSnippet}
                </pre>
                {isOwned(selectedExt.id) && (
                  <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Add this to your docker-compose.yml to activate
                  </p>
                )}
              </div>
            )}

            {/* Sepolia info */}
            {!isOwned(selectedExt.id) && (
              <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#858585] mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#007ACC]" />
                  Payment Info
                </h3>
                <ul className="space-y-1.5 text-[11px] text-[#858585]">
                  <li>• Network: <span className="text-[#CCCCCC]">Sepolia Testnet (Chain ID: 11155111)</span></li>
                  <li>• Price: <span className="text-[#4EC9B0] font-mono">{selectedExt.price} SepoliaETH</span></li>
                  <li>• Payment verified on-chain via your backend</li>
                  <li>• Get free Sepolia ETH at <a href="https://sepoliafaucet.com" target="_blank" rel="noreferrer" className="text-[#007ACC] hover:underline inline-flex items-center gap-0.5">sepoliafaucet.com <ExternalLink className="w-2.5 h-2.5" /></a></li>
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Puzzle className="w-16 h-16 text-[#3E3E42] mb-4" />
          <h2 className="text-lg font-bold text-[#555] mb-2">
            Browse Extensions
          </h2>
          <p className="text-sm text-[#3E3E42] max-w-sm">
            Select an extension from the left to see details, the docker-compose snippet, and purchase with Sepolia ETH.
          </p>
        </div>
      )}
    </div>
  );
}
