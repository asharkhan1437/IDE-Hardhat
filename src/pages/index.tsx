import { useState, useCallback, useRef, useEffect } from "react";
import { WebContainer } from "@webcontainer/api";
import JSZip from "jszip";
import { toast } from "sonner";
import { ethers } from "ethers";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import EditorPanel from "@/components/EditorPanel";
import PreviewPanel from "@/components/PreviewPanel";
import TerminalPanel from "@/components/TerminalPanel";
import SettingsDialog from "@/components/SettingsDialog";
import ExtensionMarketplace from "@/components/ExtensionMarketplace";
import type { EditorSettings } from "@/components/SettingsDialog";

// ── STORAGE KEYS (single source of truth — no more key mismatches) ──
const EXTENSIONS_KEY = "zicon-owned-extensions";
const WALLET_KEY = "zicon-wallet-address";
const SETTINGS_KEY = "zicon-settings";
const FILES_BACKUP_KEY = "ide_files_backup";

interface FileNode {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileNode[];
}

// ── Starter project files ──
const STARTER_FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "zicon-project",
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        compile: "npx hardhat compile",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.2.1",
        vite: "^5.1.0",
      },
    },
    null,
    2
  ),
  "hardhat.config.cjs": `module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: { chainId: 1337 }
  }
};`,
  "contracts/ZiconToken.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZiconToken {
    string public name = "Zicon Token";
    string public symbol = "ZIC";
    uint256 public totalSupply = 1000000 * 10**18;
    mapping(address => uint256) public balances;
    constructor() { balances[msg.sender] = totalSupply; }
    function getBalance(address account) public view returns (uint256) {
        return balances[account];
    }
}`,
  "vite.config.js": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });`,
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Zicon Project</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`,
  "src/main.jsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);`,
  "src/App.jsx": `import { useState } from 'react';
import './App.css';
function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="app">
      <header className="header">
        <h1>Welcome to Zicon-IDE</h1>
        <p>Edit <code>src/App.jsx</code> and save to see changes!</p>
        <p style={{marginTop:'10px',color:'#4EC9B0',fontSize:'0.8rem'}}>
          Hardhat Extension ready for Smart Contracts
        </p>
      </header>
      <div className="card">
        <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      </div>
    </div>
  );
}
export default App;`,
  "src/App.css": `.app{max-width:600px;margin:0 auto;padding:2rem;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.header h1{font-size:2.5rem;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.header p{color:#666;margin-top:.5rem}
code{background:#f0f0f0;padding:.2rem .5rem;border-radius:4px;font-size:.9rem}
.card{margin-top:2rem}
.card button{padding:.8rem 1.6rem;font-size:1rem;border:none;border-radius:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;cursor:pointer;transition:transform .15s,box-shadow .15s}
.card button:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(102,126,234,.4)}`,
  "src/index.css": `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafafa}`,
};

// ── Extension Registry ──
const EXTENSION_REGISTRY = [
  {
    id: "hardhat",
    name: "Hardhat Toolchain",
    pkg: "hardhat",
    price: "0.001",
    isPaid: true,
    icon: "🏗️",
    description: "Compile and deploy smart contracts on Sepolia testnet",
  },
  {
    id: "openzeppelin",
    name: "OpenZeppelin Contracts",
    pkg: "@openzeppelin/contracts",
    price: "0.0005",
    isPaid: true,
    icon: "🛡️",
    description: "Standard secure smart contract library",
  },
  {
    id: "ethers",
    name: "Ethers.js v6",
    pkg: "ethers",
    price: "0",
    isPaid: false,
    icon: "⬡",
    description: "Ethereum interaction library — free",
  },
];

// ── Helpers ──
function filesToTree(files: Record<string, string>) {
  const tree: Record<string, any> = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/");
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = { directory: {} };
      current = current[parts[i]].directory;
    }
    current[parts[parts.length - 1]] = { file: { contents } };
  }
  return tree;
}

function buildFileTree(files: Record<string, string>): FileNode[] {
  const root: FileNode = { name: ".", type: "directory", path: ".", children: [] };
  const dirMap: Record<string, FileNode> = { ".": root };

  const ensureDir = (dirPath: string): FileNode => {
    if (dirMap[dirPath]) return dirMap[dirPath];
    const parts = dirPath.split("/");
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const parent = ensureDir(parentPath);
    // FIX: store path WITHOUT leading slash so Sidebar expandedDirs matches
    const node: FileNode = {
      name: parts[parts.length - 1],
      type: "directory",
      path: dirPath, // no leading slash
      children: [],
    };
    parent.children = parent.children || [];
    if (!parent.children.find((c) => c.name === node.name && c.type === "directory")) {
      parent.children.push(node);
    }
    dirMap[dirPath] = node;
    return node;
  };

  const sortedPaths = Object.keys(files).sort();
  for (const filepath of sortedPaths) {
    const parts = filepath.split("/");
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const parent = ensureDir(parentPath);
    parent.children = parent.children || [];
    const fileName = parts[parts.length - 1];
    if (!parent.children.find((c) => c.name === fileName && c.type === "file")) {
      // FIX: file paths also without leading slash
      parent.children.push({ name: fileName, type: "file", path: filepath });
    }
  }

  const sortChildren = (node: FileNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);
  return root.children || [];
}

export default function Index() {
  // ── State ──
  const [files, setFiles] = useState<Record<string, string>>({ ...STARTER_FILES });
  const [fileTree, setFileTree] = useState<FileNode[]>(buildFileTree(STARTER_FILES));
  const [activeFile, setActiveFile] = useState<string>("src/App.jsx");
  const [openFiles, setOpenFiles] = useState<string[]>(["src/App.jsx"]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // FIX: wallet persisted to localStorage — no re-prompt on reload
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(WALLET_KEY) || null;
    }
    return null;
  });

  // FIX: single consistent key for owned extensions
  const [ownedExtensions, setOwnedExtensions] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(EXTENSIONS_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [settings, setSettings] = useState<EditorSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      fontSize: 14,
      tabSize: 2,
      wordWrap: false,
      minimap: false,
      lineNumbers: true,
      theme: "dark",
      githubToken: "",
    };
  });

  // ── GitHub state ──
  const [repos, setRepos] = useState<any[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [currentRepoUrl, setCurrentRepoUrl] = useState<string | null>(null);
  const [currentRepoName, setCurrentRepoName] = useState<string>("zicon-project");
  const [activeTab, setActiveTab] = useState<"explorer" | "github" | "extensions" | "marketplace">("explorer");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // ── Marketplace + wallet extras ──
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  // ── Refs ──
  const wcRef = useRef<any>(null);
  const terminalRef = useRef<any>(null);
  const processRef = useRef<any>(null);
  const bootingRef = useRef(false);
  const terminalListenerRef = useRef<any>(null);
  const shellInputRef = useRef<any>(null);

  // ── Stable terminal ready handler (prevents TerminalPanel remount on every render) ──
  const handleTerminalReady = useCallback((t: any) => {
    terminalRef.current = t;
  }, []);

  // ── Auth effect ──
  useEffect(() => {
    setIsAuthenticated(!!settings.githubToken && settings.githubToken.trim() !== "");
  }, [settings.githubToken]);

  // ── FIX: Auto-reconnect wallet silently on load (no popup) ──
  useEffect(() => {
    const reconnectWallet = async () => {
      const savedAddress = localStorage.getItem(WALLET_KEY);
      if (!savedAddress) return;
      if (typeof window === "undefined" || !(window as any).ethereum) {
        // MetaMask not present — still restore from storage for UI display
        setWalletAddress(savedAddress);
        return;
      }
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        // eth_accounts (NOT eth_requestAccounts) — never shows a popup
        const accounts: string[] = await provider.send("eth_accounts", []);
        if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
          setWalletAddress(accounts[0]);
        } else {
          // Account changed or locked — clear stale entry
          localStorage.removeItem(WALLET_KEY);
          setWalletAddress(null);
        }
      } catch {
        setWalletAddress(savedAddress);
      }
    };
    reconnectWallet();
  }, []);

  // ── FIX: Persist extensions with correct key ──
  useEffect(() => {
    localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(ownedExtensions));
  }, [ownedExtensions]);

  // ── refreshFileTree ──
  const refreshFileTree = useCallback(async () => {
    const container = wcRef.current;
    if (!container?.fs) return;

    const scanDirectory = async (path: string): Promise<FileNode[]> => {
      try {
        const cleanPath = path === "/" ? "." : path.startsWith("/") ? path.slice(1) : path;
        const entries = await container.fs.readdir(cleanPath, { withFileTypes: true });
        const nodes = await Promise.all(
          entries
            .filter((e: any) => e.name !== "node_modules" && e.name !== ".git")
            .map(async (entry: any) => {
              const entryPath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
              const isDir = entry.isDirectory();
              return {
                name: entry.name,
                type: isDir ? "directory" : "file",
                // FIX: strip leading slash so paths match files state keys
                path: entryPath.startsWith("/") ? entryPath.slice(1) : entryPath,
                children: isDir ? await scanDirectory(entryPath) : undefined,
              } as FileNode;
            })
        );
        return nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      } catch {
        return [];
      }
    };

    const fullTree = await scanDirectory("/");
    setFileTree(fullTree);
  }, []);

  // ── Sidebar watchdog: rebuild tree whenever files state changes ──
  useEffect(() => {
    setFileTree(buildFileTree(files));
  }, [files]);

  // ── Auto-sync file tree while running ──
  useEffect(() => {
    if (!isRunning || !wcRef.current) return;
    refreshFileTree();
    const interval = setInterval(refreshFileTree, 3000);
    return () => clearInterval(interval);
  }, [isRunning, refreshFileTree]);

  // ── Auto-restore extensions on boot ──
  useEffect(() => {
    const syncExtensions = async () => {
      if (!wcRef.current || ownedExtensions.length === 0 || !isRunning) return;
      const terminal = terminalRef.current;
      terminal?.writeln("\r\n\x1b[1;33m[System] Restoring extension toolchains...\x1b[0m");
      for (const extId of ownedExtensions) {
        const ext = EXTENSION_REGISTRY.find((e) => e.id === extId);
        if (ext) {
          terminal?.writeln(`\x1b[1;30m> Re-linking ${ext.name}...\x1b[0m`);
          try {
            const proc = await wcRef.current.spawn("npm", ["install", ext.pkg]);
            await proc.exit;
          } catch {
            terminal?.writeln(`\x1b[1;31m× Failed to link ${ext.name}\x1b[0m`);
          }
        }
      }
      terminal?.writeln("\x1b[1;32m[System] All tools synced.\x1b[0m\r\n");
      refreshFileTree();
    };
    syncExtensions();
  }, [isRunning, ownedExtensions.length, refreshFileTree]);

  // ── Backup files to localStorage ──
  useEffect(() => {
    if (Object.keys(files).length > 0) {
      localStorage.setItem(FILES_BACKUP_KEY, JSON.stringify(files));
    }
  }, [files]);

  // ── Restore files from backup after WebContainer boots ──
  useEffect(() => {
    const restoreFiles = async () => {
      const backup = localStorage.getItem(FILES_BACKUP_KEY);
      if (!backup || !wcRef.current) return;
      try {
        const restoredFiles = JSON.parse(backup);
        setFiles(restoredFiles);
        for (const [path, content] of Object.entries(restoredFiles)) {
          const parts = path.split("/");
          if (parts.length > 1) {
            const dir = parts.slice(0, -1).join("/");
            await wcRef.current.fs.mkdir(dir, { recursive: true });
          }
          await wcRef.current.fs.writeFile(path, content as string);
        }
        setFileTree(buildFileTree(restoredFiles));
      } catch (err) {
        console.error("Failed to restore files:", err);
      }
    };
    restoreFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcRef.current]);

  // ── Autosave ──
  useEffect(() => {
    if (!activeFile || !files[activeFile]) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("http://localhost:5000/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: activeFile, content: files[activeFile] }),
        });
        setSaveStatus(response.ok ? "saved" : "error");
        if (response.ok) setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [files[activeFile], activeFile]);

  // ── GitHub OAuth callback ──
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code && !isAuthenticated) {
      setActiveTab("github");
      handleExchangeCodeForToken(code);
      window.history.replaceState({}, document.title, "/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── fetchFiles (backend sync) ──
  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/api/files");
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
        if (wcRef.current) await wcRef.current.mount(filesToTree(data) as any);
        await refreshFileTree();
      }
    } catch {
      console.warn("Backend offline.");
    }
  }, [refreshFileTree]);

  // ── Initial load ──
  useEffect(() => {
    const backup = localStorage.getItem(FILES_BACKUP_KEY);
    if (!backup) fetchFiles();
  }, [fetchFiles]);

  // ── WebContainer boot ──
  const bootWebContainer = useCallback(async () => {
    if (wcRef.current || bootingRef.current) return wcRef.current;
    bootingRef.current = true;
    try {
      const terminal = terminalRef.current;
      terminal?.writeln("\x1b[1;33m⚡ Booting WebContainer...\x1b[0m");
      const wc = await WebContainer.boot();
      wcRef.current = wc;
      await wc.mount(filesToTree(files) as any);
      wc.on("server-ready", (_port: number, url: string) => {
        setPreviewUrl(url);
        setIsLoading(false);
        setIsRunning(true);
        terminal?.writeln(`\x1b[1;32m✓ Dev server ready at ${url}\x1b[0m`);
      });
      bootingRef.current = false;
      return wc;
    } catch (err) {
      console.error("Boot failed", err);
      bootingRef.current = false;
      return null;
    }
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning || isLoading) return;
    setIsLoading(true);
    const wc = await bootWebContainer();
    if (!wc) { setIsLoading(false); return; }
    try {
      terminalListenerRef.current?.dispose();
      setIsRunning(true);
      const terminal = terminalRef.current;

      // ── Smart run detection based on active file ──
      const ext = activeFile.split(".").pop()?.toLowerCase();
      const isPython = ext === "py";
      const isNode = ext === "js" || ext === "ts" || ext === "mjs";
      const isSolidity = ext === "sol";

      if (isPython) {
        // Python via Pyodide in terminal
        terminal?.writeln("\x1b[1;33m🐍 Detected Python file — running via Pyodide...\x1b[0m");
        terminal?.writeln("\x1b[90mNote: Install Pyodide extension for full Python support\x1b[0m\r\n");
      }

      const shellProcess = await wc.spawn("jsh", { terminal: { cols: 80, rows: 24 } });
      processRef.current = shellProcess;
      shellProcess.output.pipeTo(new WritableStream({ write(data) { terminal?.write(data); } }));
      const input = shellProcess.input.getWriter();
      shellInputRef.current = input;
      terminalListenerRef.current = terminal?.onData((data: string) => { input.write(data); });
      terminal?.writeln("\x1b[1;34m[Zicon] Shell ready. Type commands or use npm run dev\x1b[0m\r\n");

      // Auto-run npm install then npm run dev for web projects
      if (!isPython && !isNode && !isSolidity) {
        setTimeout(async () => {
          terminal?.writeln("\x1b[1;33m📦 Installing dependencies (first run may take a minute)...\x1b[0m");
          await input.write("npm install && npm run dev\n");
        }, 500);
      }

      shellProcess.exit.then((code: number) => {
        terminal?.writeln(`\r\n\x1b[1;33m[System] Process exited (${code})\x1b[0m`);
        setIsRunning(false);
        setIsLoading(false);
        terminalListenerRef.current?.dispose();
        terminalListenerRef.current = null;
        shellInputRef.current = null;
      });
    } catch (err) {
      console.error("Shell error:", err);
      setIsRunning(false);
      setIsLoading(false);
    }
  }, [bootWebContainer, isRunning, isLoading, activeFile]);

  // ── Restart terminal without stopping the container ──
  const handleRestartTerminal = useCallback(async () => {
    if (!wcRef.current) return;
    terminalListenerRef.current?.dispose();
    terminalListenerRef.current = null;
    const terminal = terminalRef.current;
    terminal?.writeln("\r\n\x1b[1;33m[System] Restarting shell...\x1b[0m");
    try {
      const shellProcess = await wcRef.current.spawn("jsh", { terminal: { cols: 80, rows: 24 } });
      processRef.current = shellProcess;
      shellProcess.output.pipeTo(new WritableStream({ write(data) { terminal?.write(data); } }));
      const input = shellProcess.input.getWriter();
      shellInputRef.current = input;
      terminalListenerRef.current = terminal?.onData((data: string) => { input.write(data); });
      terminal?.writeln("\x1b[1;32m[System] Shell restarted.\x1b[0m\r\n");
      shellProcess.exit.then(() => {
        setIsRunning(false);
        setIsLoading(false);
        shellInputRef.current = null;
      });
    } catch {
      terminal?.writeln("\x1b[1;31m[System] Restart failed.\x1b[0m");
    }
  }, []);

  const handleStop = useCallback(() => {
    try { processRef.current?.kill(); } catch {}
    terminalListenerRef.current?.dispose();
    terminalListenerRef.current = null;
    shellInputRef.current = null;
    setIsRunning(false);
    setIsLoading(false);
    setPreviewUrl(null);
    processRef.current = null;
    terminalRef.current?.writeln("\r\n\x1b[1;31m■ Stopped.\x1b[0m");
  }, []);

  // ── FIX: Wallet connect — saves address + switches to Sepolia testnet ──
  const handleConnectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      return toast.error("MetaMask not found. Please install the extension.");
    }
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);

      // Switch to Sepolia testnet (chainId 0xaa36a7 = 11155111)
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }],
        });
      } catch (switchErr: any) {
        // Chain not added yet — add it
        if (switchErr.code === 4902) {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0xaa36a7",
              chainName: "Sepolia Testnet",
              nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            }],
          });
        }
      }

      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      const signer = await provider.getSigner();
      const message = `Zicon IDE Login\nAddress: ${address}\nTimestamp: ${Date.now()}`;
      await signer.signMessage(message);

      // FIX: persist wallet so same wallet never re-prompts
      setWalletAddress(address);
      localStorage.setItem(WALLET_KEY, address);
      toast.success("Wallet connected on Sepolia testnet!");
    } catch (err: any) {
      if (err.code === 4001) toast.error("Connection rejected by user.");
      else toast.error("Wallet connection failed.");
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    setWalletBalance(null);
    setIsWrongNetwork(false);
    localStorage.removeItem(WALLET_KEY);
    toast.info("Wallet disconnected");
  };

  // ── Fetch wallet balance ──
  const fetchWalletBalance = useCallback(async (address: string) => {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const bal = await provider.getBalance(address);
      setWalletBalance(ethers.formatEther(bal).slice(0, 6));
    } catch { setWalletBalance(null); }
  }, []);

  // ── Switch to Sepolia ──
  const handleSwitchToSepolia = useCallback(async () => {
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      setIsWrongNetwork(false);
    } catch {}
  }, []);

  // ── Listen for chain/account changes ──
  useEffect(() => {
    if (!(window as any).ethereum) return;
    const onChainChanged = (chainId: string) => {
      const wrong = chainId !== "0xaa36a7";
      setIsWrongNetwork(wrong);
      if (wrong) toast.warning("Wrong network! Switch to Sepolia.", {
        action: { label: "Switch", onClick: handleSwitchToSepolia }
      });
    };
    const onAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) handleDisconnectWallet();
    };
    (window as any).ethereum.on("chainChanged", onChainChanged);
    (window as any).ethereum.on("accountsChanged", onAccountsChanged);
    return () => {
      (window as any).ethereum?.removeListener("chainChanged", onChainChanged);
      (window as any).ethereum?.removeListener("accountsChanged", onAccountsChanged);
    };
  }, [handleDisconnectWallet, handleSwitchToSepolia]);

  // ── Fetch balance when wallet connects ──
  useEffect(() => {
    if (walletAddress && (window as any).ethereum) fetchWalletBalance(walletAddress);
  }, [walletAddress, fetchWalletBalance]);

  // ── Real Sepolia purchase for marketplace extensions ──
  const handleMarketplacePurchase = useCallback(async (
    extensionId: string,
    priceEth: string
  ): Promise<{ success: boolean }> => {
    if (!walletAddress) {
      toast.error("Connect your wallet first.");
      return { success: false };
    }
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        await handleSwitchToSepolia();
      }
      const signer = await provider.getSigner();
      const STORE_WALLET = "0xA9FAABCD9372AA1FCD175c3f1a7CfA0b0f8a7916";
      toast.loading("Confirm in MetaMask...", { id: "mp-tx" });
      const tx = await signer.sendTransaction({
        to: STORE_WALLET,
        value: ethers.parseEther(priceEth),
      });
      toast.loading("Waiting for confirmation...", { id: "mp-tx" });
      const receipt = await tx.wait();
      toast.dismiss("mp-tx");
      if (receipt?.status === 1) {
        const res = await fetch("http://localhost:5000/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: tx.hash, address: walletAddress, extensionId }),
        });
        const data = await res.json();
        if (data.success) {
          const updated = [...ownedExtensions.filter(e => e !== extensionId), extensionId];
          setOwnedExtensions(updated);
          localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(updated));
          toast.success(`Extension purchased! Tx: ${tx.hash.slice(0, 10)}...`);
          return { success: true };
        }
      }
      toast.error("Payment verification failed.");
      return { success: false };
    } catch (err: any) {
      toast.dismiss("mp-tx");
      if (err.code === 4001 || err.code === "ACTION_REJECTED") toast.error("Transaction rejected.");
      else toast.error("Purchase failed: " + err.message?.slice(0, 50));
      return { success: false };
    }
  }, [walletAddress, ownedExtensions, handleSwitchToSepolia]);

  const checkOwnership = useCallback((id: string) => {
    return ownedExtensions.includes(id);
  }, [ownedExtensions]);

  // ── Send a command from the marketplace into the WebContainer terminal ──
  const runTerminalCommand = useCallback((command: string, instructions?: string) => {
    if (!shellInputRef.current) {
      toast.error("Terminal not active", {
        description: "Click Run first to boot the IDE terminal, then try installing again.",
        duration: 6000,
      });
      return;
    }
    const terminal = terminalRef.current;
    terminal?.writeln(`\r\n\x1b[1;35m[Extension] Installing via terminal...\x1b[0m`);
    shellInputRef.current.write(`${command}\n`);
    toast.success("Command sent to terminal!", {
      description: instructions || `Running: ${command}`,
      duration: 8000,
    });
  }, []);

  // ── GitHub handlers ──
  const handleGithubClone = async (repoUrl: string) => {
    const loadingToast = toast.loading("Cloning repository...");
    try {
      const response = await fetch("http://localhost:5000/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, token: settings.githubToken }),
      });
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
        setCurrentRepoUrl(repoUrl);
        setCurrentRepoName(data.repoName);
        if (wcRef.current) {
          await wcRef.current.mount(filesToTree(data.files) as any);
          await refreshFileTree();
        }
        toast.success(`Cloned ${data.repoName}!`, { id: loadingToast });
      } else throw new Error(data.message);
    } catch (err: any) {
      toast.error(err.message || "Clone failed", { id: loadingToast });
    }
  };

  const handleFetchRepos = useCallback(async () => {
    if (!settings.githubToken) return toast.error("Connect GitHub first");
    setIsFetchingRepos(true);
    try {
      const response = await fetch("http://localhost:5000/api/repos", {
        headers: { Authorization: `Bearer ${settings.githubToken}` },
      });
      const data = await response.json();
      if (data.success) setRepos(data.repos);
    } catch {
      toast.error("Fetch failed");
    } finally {
      setIsFetchingRepos(false);
    }
  }, [settings.githubToken]);

  const handleGithubLogin = useCallback(() => {
    if (settings.githubToken) {
      toast.success("Refreshing repository list...");
      handleFetchRepos();
      return;
    }
    const CLIENT_ID = "Ov23li2xmxwOUm9hqgib";
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,user`;
  }, [settings.githubToken, handleFetchRepos]);

  const handleGithubLogout = useCallback(() => {
    const newSettings = { ...settings, githubToken: "" };
    setSettings(newSettings);
    setRepos([]);
    setFiles({});
    setActiveFile("");
    setOpenFiles([]);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    window.history.replaceState({}, document.title, "/");
    toast.success("Logged out");
  }, [settings]);

  const handleGitCommit = async () => {
    if (!settings.githubToken) return toast.error("Add a GitHub Token in Settings first.");
    if (!currentRepoUrl) return toast.error("No repository linked. Clone a project first.");
    toast.loading("Pushing to GitHub...");
    try {
      const response = await fetch("http://localhost:5000/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, token: settings.githubToken, repoName: currentRepoName, repoUrl: currentRepoUrl }),
      });
      const data = await response.json();
      toast.dismiss();
      if (data.success) toast.success("Pushed to GitHub!");
      else toast.error("Push failed: " + data.message);
    } catch {
      toast.dismiss();
      toast.error("Could not connect to backend.");
    }
  };

  const handleExchangeCodeForToken = useCallback(async (code: string) => {
  try {
    setIsFetchingRepos(true);
    const response = await fetch("http://localhost:5000/api/github/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();

    if (data.access_token) {
      const newSettings = { ...settings, githubToken: data.access_token };
      setSettings(newSettings);
      // CRITICAL: Update the boolean state immediately
      setIsAuthenticated(true); 
      
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));

      // Fetch repos using the new token
      const repoRes = await fetch("https://api.github.com/user/repos", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const repoData = await repoRes.json();
      setRepos(Array.isArray(repoData) ? repoData : []);
      
      toast.success("GitHub Connected!");
      // Clean the URL so the 'code' param doesn't trigger this again
      window.history.replaceState({}, document.title, "/");
    }
  } catch (err) {
    console.error("Auth failed", err);
    toast.error("Failed to connect GitHub");
  } finally {
    setIsFetchingRepos(false);
  }
}, [settings]);

  // ── FIX: Extensions — Sepolia testnet mock payment that persists ──
  const handleInstallExtension = async (extId: string, isPaid: boolean) => {
    const ext = EXTENSION_REGISTRY.find((e) => e.id === extId);
    if (!ext) return toast.error("Extension not found.");

    // Uninstall toggle
    if (ownedExtensions.includes(extId)) {
      const updated = ownedExtensions.filter((id) => id !== extId);
      setOwnedExtensions(updated);
      localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(updated));
      terminalRef.current?.writeln(`\r\n\x1b[1;31m[System] ${ext.name} uninstalled.\x1b[0m`);
      return toast.info(`${ext.name} uninstalled.`);
    }

    // Wallet guard for paid extensions
    if (isPaid && !walletAddress) {
      return toast.error("Connect your wallet first to purchase extensions.");
    }

    const toastId = toast.loading(isPaid ? `Initiating Sepolia payment...` : `Installing ${ext.name}...`);

    try {
      // ── SEPOLIA TESTNET MOCK PAYMENT ──
      // This sends a REAL transaction on Sepolia (test ETH, worthless)
      // so it looks authentic but costs nothing real.
      if (isPaid && walletAddress) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);

        // Ensure we're on Sepolia
        const network = await provider.getNetwork();
        if (network.chainId !== 11155111n) {
          toast.loading("Switching to Sepolia testnet...", { id: toastId });
          try {
            await (window as any).ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0xaa36a7" }],
            });
          } catch {
            return toast.error("Please switch to Sepolia testnet in MetaMask.", { id: toastId } as any);
          }
        }

        const signer = await provider.getSigner();
        toast.loading(`Sending ${ext.price} SepoliaETH...`, { id: toastId });

        // Sign a message to confirm intent (no actual ETH sent — avoids needing testnet funds)
        // To send a real testnet tx instead, swap signMessage for sendTransaction below
        const message = `Zicon IDE: Purchase ${ext.name} for ${ext.price} ETH\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
        await signer.signMessage(message);

        // Optional: uncomment below to send a real Sepolia tx (needs test ETH from faucet)
        // const tx = await signer.sendTransaction({
        //   to: "0xA9FAABCD9372AA1FCD175c3f1a7CfA0b0f8a7916",
        //   value: ethers.parseEther(ext.price),
        // });
        // toast.loading("Confirming on Sepolia...", { id: toastId });
        // await tx.wait();

        toast.loading("Payment confirmed! Installing...", { id: toastId });
      }

      // ── npm install inside WebContainer ──
      if (wcRef.current) {
        terminalRef.current?.writeln(`\r\n\x1b[1;34m[Zicon] Installing ${ext.pkg}...\x1b[0m`);
        const installProc = await wcRef.current.spawn("npm", ["install", ext.pkg]);
        installProc.output.pipeTo(
          new WritableStream({ write(data) { terminalRef.current?.write(data); } })
        );
        const exitCode = await installProc.exit;
        if (exitCode !== 0) throw new Error("npm install failed.");
      }

      // ── Hardhat auto-config ──
      if (extId === "hardhat" && wcRef.current) {
        const config = `module.exports = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  paths: { sources: "./contracts", artifacts: "./artifacts", cache: "./cache" }
};`;
        await wcRef.current.fs.writeFile("hardhat.config.cjs", config);
        try { await wcRef.current.fs.mkdir("contracts"); } catch {}
        await refreshFileTree();
        terminalRef.current?.writeln(`\x1b[1;32m[Hardhat] Configured for Sepolia testnet.\x1b[0m\r\n`);
      }

      // ── FIX: Persist with correct key ──
      const updatedExtensions = [...ownedExtensions, extId];
      setOwnedExtensions(updatedExtensions);
      localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(updatedExtensions));

      toast.success(`${ext.name} activated!`, { id: toastId });
    } catch (err: any) {
      console.error("Install Error:", err);
      if (err.code === 4001) toast.error("Signature rejected.", { id: toastId } as any);
      else toast.error("Installation failed.", { id: toastId } as any);
    }
  };

  const handleAuditCode = async () => {
    if (!activeFile.endsWith(".sol")) return toast.error("Open a Solidity (.sol) file to audit.");
    if (!walletAddress) return toast.error("Connect wallet to use Zicon Sentinel.");
    const toastId = toast.loading("Zicon Sentinel: Analyzing...");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const message = `Authorize Zicon Security Scan for ${activeFile}`;
      const signature = await signer.signMessage(message);
      const res = await fetch("http://localhost:5000/api/audit-solidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress, signature, message, content: files[activeFile] }),
      });
      if (!res.ok) throw new Error("Backend unreachable");
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.success) {
        data.reports.forEach((msg: string) => {
          msg.includes("✅") ? toast.success(msg) : toast.error(msg, { duration: 6000 });
        });
      } else toast.error(data.message || "Audit failed.");
    } catch (err: any) {
      toast.dismiss(toastId);
      if (err.code === 4001 || err.message?.includes("rejected")) toast.error("Signature denied.");
      else toast.error("Audit failed. Ensure backend is running.");
    }
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    Object.entries(files).forEach(([path, content]) => zip.file(path, content));
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = `${currentRepoName || "zicon-project"}.zip`;
    a.click();
    toast.success("Downloaded ZIP");
  };

  const syncVirtualFilesToState = useCallback(async () => {
    if (!wcRef.current) return;
    const newFiles: Record<string, string> = {};
    const readRecursive = async (path: string) => {
      const entries = await wcRef.current.fs.readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path === "/" ? entry.name : `${path}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!["node_modules", "cache", ".cache"].includes(entry.name)) await readRecursive(fullPath);
        } else {
          newFiles[fullPath] = await wcRef.current.fs.readFile(fullPath, "utf-8");
        }
      }
    };
    try {
      await readRecursive("/");
      setFiles((prev) => ({ ...prev, ...newFiles }));
      await refreshFileTree();
    } catch (err) {
      console.error("Sync-back failed:", err);
    }
  }, [refreshFileTree]);

  const handleCompile = async () => {
  if (!ownedExtensions.includes("hardhat")) return toast.error("Install Hardhat extension first.");
  if (!wcRef.current) return toast.error("IDE not ready yet.");
  
  const toastId = toast.loading("Hardhat: Compiling...");
  const terminal = terminalRef.current;

  try {
    terminal?.writeln("\r\n\x1b[1;36m[System] Syncing files...\x1b[0m");
    
    // Ensure hardhat is actually installed in the node_modules
    // The --yes flag bypasses the "Proceed with y?" prompt
    const compileProc = await wcRef.current.spawn("npx", [
      "--yes", 
      "hardhat", 
      "compile", 
      "--config", 
      "hardhat.config.cjs"
    ]);

    compileProc.output.pipeTo(
      new WritableStream({
        write(data) {
          terminal?.write(data);
        },
      })
    );

    const exitCode = await compileProc.exit;
    if (exitCode === 0) {
      toast.success("Compiled successfully!", { id: toastId });
      await syncVirtualFilesToState();
    } else {
      toast.error("Compilation failed. Check terminal.", { id: toastId });
    }
  } catch (err: any) {
    toast.error("Critical compile error.", { id: toastId });
    terminal?.writeln(`\x1b[1;31m[Critical] ${err.message}\x1b[0m\r\n`);
  }
};

  // ── File handlers ──
  const handleFileSelect = useCallback((path: string) => {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    setActiveFile(cleanPath);
    if (!openFiles.includes(cleanPath)) setOpenFiles((prev) => [...prev, cleanPath]);
  }, [openFiles]);

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f !== path);
      if (activeFile === path) setActiveFile(next[next.length - 1] || "");
      return next;
    });
  }, [activeFile]);

  const handleContentChange = useCallback((content: string) => {
    setFiles((prev) => ({ ...prev, [activeFile]: content }));
    if (wcRef.current) wcRef.current.fs.writeFile(activeFile, content).catch(() => {});
  }, [activeFile]);

  // FIX: handleCreateFile — also works without WebContainer running
  const handleCreateFile = useCallback(async (dir: string, name: string) => {
    const cleanDir = dir.startsWith("/") ? dir.slice(1) : dir;
    const fullPath = cleanDir === "" || cleanDir === "." ? name : `${cleanDir}/${name}`;
    setFiles((prev) => ({ ...prev, [fullPath]: "" }));
    if (wcRef.current) {
      try {
        // Ensure parent directory exists
        const parts = fullPath.split("/");
        if (parts.length > 1) {
          const parentDir = parts.slice(0, -1).join("/");
          await wcRef.current.fs.mkdir(parentDir, { recursive: true });
        }
        await wcRef.current.fs.writeFile(fullPath, "");
        await refreshFileTree();
      } catch (err) {
        console.error("FS Error creating file:", err);
      }
    }
    handleFileSelect(fullPath);
    toast.success(`Created ${name}`);
  }, [handleFileSelect, refreshFileTree]);

  // FIX: handleCreateFolder — works with and without WebContainer
  const handleCreateFolder = useCallback(async (dirPath: string, name: string) => {
    const cleanDir = dirPath.startsWith("/") ? dirPath.slice(1) : dirPath;
    const folderPath = cleanDir === "" || cleanDir === "." ? name : `${cleanDir}/${name}`;
    const placeholder = `${folderPath}/.keep`;

    // Always update React state immediately so sidebar shows the folder
    setFiles((prev) => ({ ...prev, [placeholder]: "" }));

    if (wcRef.current) {
      try {
        await wcRef.current.fs.mkdir(folderPath, { recursive: true });
        await wcRef.current.fs.writeFile(placeholder, "");
        await refreshFileTree();
      } catch (err) {
        console.error("Folder creation failed:", err);
      }
    }
    // If WebContainer isn't running, buildFileTree watchdog handles the sidebar update
    toast.success(`Folder created: ${name}`);
  }, [refreshFileTree]);

  const handleDeleteFile = useCallback(async (path: string) => {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    if (!window.confirm(`Delete ${cleanPath}?`)) return;
    try {
      if (wcRef.current) await wcRef.current.fs.rm(cleanPath, { recursive: true });
      setFiles((prev) => {
        const next = { ...prev };
        delete next[cleanPath];
        Object.keys(next).forEach((k) => { if (k.startsWith(`${cleanPath}/`)) delete next[k]; });
        return next;
      });
      setOpenFiles((prev) => prev.filter((f) => f !== cleanPath));
      if (activeFile === cleanPath) setActiveFile("");
      await refreshFileTree();
      fetch("http://localhost:5000/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: cleanPath }),
      }).catch(() => {});
      toast.success(`Deleted ${cleanPath}`);
    } catch {
      toast.error("Failed to delete.");
    }
  }, [activeFile, refreshFileTree]);

  const handleRenameFile = async (oldPath: string, newPathOrName: string) => {
    const cleanOld = oldPath.startsWith("/") ? oldPath.slice(1) : oldPath;
    let newPath = newPathOrName.includes("/")
      ? newPathOrName
      : [...cleanOld.split("/").slice(0, -1), newPathOrName].join("/");
    if (cleanOld === newPath) return;
    const content = files[cleanOld];
    setFiles((prev) => { const n = { ...prev }; delete n[cleanOld]; n[newPath] = content; return n; });
    setOpenFiles((prev) => prev.map((f) => (f === cleanOld ? newPath : f)));
    if (activeFile === cleanOld) setActiveFile(newPath);
    if (wcRef.current) {
      try {
        await wcRef.current.fs.writeFile(newPath, content);
        await wcRef.current.fs.rm(cleanOld);
      } catch (err) { console.error("Rename error:", err); }
    }
    try {
      const res = await fetch("http://localhost:5000/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath: cleanOld, newPath }),
      });
      if (!res.ok) throw new Error();
      toast.success("Renamed");
    } catch {
      toast.error("Rename failed");
      fetchFiles();
    }
  };

  const handleOpenFolder = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      const loadedFiles: Record<string, string> = {};
      const readDirectory = async (handle: any, relativePath = "") => {
        for await (const entry of handle.values()) {
          const path = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          if (entry.kind === "directory") await readDirectory(entry, path);
          else loadedFiles[path] = await (await entry.getFile()).text();
        }
      };
      toast.loading("Reading local folder...");
      await readDirectory(dirHandle);
      setFiles(loadedFiles);
      setCurrentRepoName(dirHandle.name);
      if (Object.keys(loadedFiles).length > 0) {
        const first = Object.keys(loadedFiles)[0];
        setActiveFile(first);
        setOpenFiles([first]);
      }
      if (wcRef.current) {
        await wcRef.current.mount(filesToTree(loadedFiles) as any);
        await refreshFileTree();
      }
      toast.dismiss();
      toast.success(`Opened: ${dirHandle.name}`);
    } catch (err: any) {
      if (err.name !== "AbortError") toast.error("Folder access denied.");
    }
  };

  const handleFork = useCallback(() => {
    const newName = prompt("Enter a name for your fork:", `${currentRepoName}-copy`);
    if (!newName) return;
    setCurrentRepoName(newName);
    toast.success(`Forked to ${newName}!`);
  }, [currentRepoName]);

  const handleSettingsUpdate = useCallback((newSettings: EditorSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  }, []);

  const handleTerminalInput = useCallback(async (data: string) => {
    if (processRef.current?.input) {
      const writer = processRef.current.input.getWriter();
      try { await writer.write(data); } finally { writer.releaseLock(); }
    }
  }, []);

  const handleInitializeCarbon = async () => {
    if (!walletAddress) return toast.error("Connect wallet to access Carbon Engine.");
    const projectName = prompt("Enter Carbon project name:", "my-carbon-token");
    if (!projectName) return;
    const toastId = toast.loading("Injecting Carbon Token Engine...");
    try {
      const response = await fetch("http://localhost:5000/api/initialize-carbon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, projectName }),
      });
      const data = await response.json();
      if (data.success && data.files) {
        setFiles(data.files);
        setCurrentRepoName(projectName);
        const solFiles = Object.keys(data.files).filter((f) => f.endsWith(".sol"));
        if (solFiles.length > 0) { setActiveFile(solFiles[0]); setOpenFiles(solFiles); }
        if (wcRef.current) {
          for (const [path, content] of Object.entries(data.files)) {
            const parts = path.split("/");
            if (parts.length > 1) {
              await wcRef.current.fs.mkdir(parts.slice(0, -1).join("/"), { recursive: true });
            }
            await wcRef.current.fs.writeFile(path, content as string);
          }
          await refreshFileTree();
        }
        toast.success("Carbon Engine Deployed!", { id: toastId });
      } else throw new Error(data.error || "Failed.");
    } catch (err: any) {
      toast.error(`Initialization failed: ${err.message}`, { id: toastId });
    }
  };

  // ── Render ──
  return (
    <div className="h-screen flex flex-col bg-[#1E1E1E] text-[#CCCCCC] overflow-hidden">
      <TopBar
        projectName={currentRepoName}
        saveStatus={saveStatus}
        isRunning={isRunning}
        isAuthenticated={isAuthenticated}
        onLogin={isAuthenticated ? handleGithubLogout : handleGithubLogin}
        onRun={handleRun}
        onStop={handleStop}
        onDownload={handleDownload}
        onSettingsOpen={() => setSettingsOpen(true)}
        onFork={handleFork}
        onCommit={handleGitCommit}
        onOpenFolder={handleOpenFolder}
        onAudit={handleAuditCode}
        onCompile={handleCompile}
        isHardhatActive={ownedExtensions.includes("hardhat")}
        // ── Web3 props ──
        walletAddress={walletAddress}
        walletBalance={walletBalance}
        isWrongNetwork={isWrongNetwork}
        onConnectWallet={walletAddress ? handleDisconnectWallet : handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onSwitchNetwork={handleSwitchToSepolia}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={18} minSize={12}>
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            fileTree={fileTree}
            activeFile={activeFile}
            openFiles={openFiles}
            onFileSelect={handleFileSelect}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            repos={repos}
            onClone={handleGithubClone}
            onFetchRepos={handleFetchRepos}
            onGitHubLogin={handleGithubLogin}
            onInstallExtension={(id, price) => handleInstallExtension(id, true)}
            isFetchingRepos={isFetchingRepos}
            ownedExtensions={ownedExtensions}
            extensionRegistry={EXTENSION_REGISTRY}
            // ── Web3 props ──
            walletAddress={walletAddress}
            checkOwnership={checkOwnership}
            onOpenMarketplace={() => setShowMarketplace(true)}
          />
        </ResizablePanel>

        <ResizableHandle className="w-[1px] bg-[#3E3E42] hover:bg-[#007ACC] transition-colors" />

        <ResizablePanel defaultSize={42}>
          {showMarketplace ? (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="h-9 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-4 shrink-0">
                <span className="text-xs text-[#858585] uppercase tracking-wider font-semibold">
                  Extension Marketplace
                </span>
                <button
                  onClick={() => setShowMarketplace(false)}
                  className="text-[#555] hover:text-white text-xs px-2 py-1 hover:bg-[#333] rounded transition-colors"
                >
                  ✕ Close
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ExtensionMarketplace
                  walletAddress={walletAddress}
                  onConnectWallet={handleConnectWallet}
                  onPurchase={handleMarketplacePurchase}
                  checkOwnership={checkOwnership}
                  onRunInTerminal={runTerminalCommand}
                />
              </div>
            </div>
          ) : (
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70}>
                <EditorPanel
                  activeFile={activeFile}
                  content={files[activeFile] || ""}
                  openFiles={openFiles}
                  settings={settings}
                  onContentChange={handleContentChange}
                  onFileSelect={handleFileSelect}
                  onCloseFile={handleCloseFile}
                  saveStatus={saveStatus}
                  isWalletConnected={!!walletAddress}
                />
              </ResizablePanel>
              <ResizableHandle className="h-[1px] bg-[#3E3E42] hover:bg-[#007ACC] transition-colors" />
              <ResizablePanel defaultSize={30}>
                <div className="h-full flex flex-col">
                  <div className="h-[30px] bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-3">
                    <span className="text-xs font-medium text-[#858585]">Terminal</span>
                    <div className="flex items-center gap-1">
                      {isRunning && (
                        <span className="text-[9px] text-green-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          Running
                        </span>
                      )}
                      <button
                        onClick={handleRestartTerminal}
                        className="text-[#555] hover:text-white text-[10px] px-1.5 py-0.5 hover:bg-[#333] rounded transition-colors ml-2"
                        title="Restart shell"
                      >
                        ↺ Restart
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TerminalPanel
                      onTerminalReady={handleTerminalReady}
                      onData={handleTerminalInput}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </ResizablePanel>

        <ResizableHandle className="w-[1px] bg-[#3E3E42] hover:bg-[#007ACC] transition-colors" />

        <ResizablePanel defaultSize={40}>
          <PreviewPanel previewUrl={previewUrl} isLoading={isLoading} />
        </ResizablePanel>
      </ResizablePanelGroup>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={handleSettingsUpdate}
      />
    </div>
  );
}
