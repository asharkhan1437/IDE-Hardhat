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
import AIAssistant from "@/components/AIAssistant";
import CollabUsers from "@/components/CollabUsers";
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
  for (const [rawPath, contents] of Object.entries(files)) {
    // Sanitize: normalize slashes, strip leading/trailing slashes, drop empty segments
    const cleanPath = rawPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
    const parts = cleanPath.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) continue; // skip invalid/empty paths entirely
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || !current[parts[i]].directory) {
        current[parts[i]] = { directory: {} };
      }
      current = current[parts[i]].directory;
    }
    current[parts[parts.length - 1]] = { file: { contents: contents ?? "" } };
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
    const node: FileNode = {
      name: parts[parts.length - 1],
      type: "directory",
      path: dirPath,
      children: [],
    };
    parent.children = parent.children || [];
    if (!parent.children.find((c) => c.name === node.name && c.type === "directory")) {
      parent.children.push(node);
    }
    dirMap[dirPath] = node;
    return node;
  };

  // Normalize ALL paths: backslashes → forward slashes, strip leading slash
  const normalize = (p: string) => p.replace(/\\/g, "/").replace(/^\//, "");

  const normalizedFiles: Record<string, string> = {};
  for (const [key, val] of Object.entries(files)) {
    normalizedFiles[normalize(key)] = val;
  }

  const sortedPaths = Object.keys(normalizedFiles).sort();
  for (const filepath of sortedPaths) {
    const parts = filepath.split("/");
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const parent = ensureDir(parentPath);
    parent.children = parent.children || [];
    const fileName = parts[parts.length - 1];
    if (!parent.children.find((c) => c.name === fileName && c.type === "file")) {
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
  const [loadingStage, setLoadingStage] = useState("Booting WebContainer...");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // FIX: wallet persisted to localStorage — no re-prompt on reload
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(WALLET_KEY) || null;
    }
    return null;
  });

  // Extensions are owned per-wallet, not per-browser. Seed from that wallet's
  // cached list (if any) — the real source of truth is fetched from the
  // backend once the wallet reconnects (see reconnectWallet effect below).
  const [ownedExtensions, setOwnedExtensions] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedAddress = localStorage.getItem(WALLET_KEY);
        if (!savedAddress) return [];
        const saved = localStorage.getItem(`${EXTENSIONS_KEY}:${savedAddress.toLowerCase()}`);
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
      geminiKey: "",
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
  const [showAIChat, setShowAIChat] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  // ── Refs ──
  const wcRef = useRef<any>(null);
  const terminalRef = useRef<any>(null);
  const processRef = useRef<any>(null);
  const bootingRef = useRef(false);
  const terminalListenerRef = useRef<any>(null);
  const shellInputRef = useRef<any>(null);
  const filesRef = useRef<Record<string, string>>({});

  // ── Stable terminal ready handler (prevents TerminalPanel remount on every render) ──
  const handleTerminalReady = useCallback((t: any) => {
    terminalRef.current = t;
  }, []);

  // ── Auth effect ──
  useEffect(() => {
    // Warn before refresh/close when WebContainer is running — a refresh means
    // a full cold boot (30-60s npm install). Use Stop → Run instead.
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (wcRef.current) {
        e.preventDefault();
        e.returnValue = "WebContainer is running — refreshing will require a full reinstall (~30-60s). Use Stop → Run instead to restart in seconds.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
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
          fetchOwnedExtensions(accounts[0]);
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

  // ── Persist extensions under this wallet's key, not a global one ──
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem(`${EXTENSIONS_KEY}:${walletAddress.toLowerCase()}`, JSON.stringify(ownedExtensions));
    }
  }, [ownedExtensions, walletAddress]);

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
  // NOTE: The watchdog on files state (above) handles sidebar updates.
  // Only run periodic refresh when WebContainer is active to pick up
  // terminal-generated files (e.g. artifacts after compile)
  useEffect(() => {
    if (!isRunning || !wcRef.current) return;
    const interval = setInterval(refreshFileTree, 5000);
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
      try {
        localStorage.setItem(FILES_BACKUP_KEY, JSON.stringify(files));
      } catch (err) {
        // Project too large for localStorage (e.g. cloned a big repo) —
        // skip the backup rather than crashing the whole app.
        if (err instanceof DOMException && err.name === "QuotaExceededError") {
          console.warn("[Zicon] Project too large to back up to localStorage — skipping backup.");
          // Clear any stale partial backup so it doesn't confuse restore-on-load
          try { localStorage.removeItem(FILES_BACKUP_KEY); } catch {}
        } else {
          console.error("[Zicon] Failed to back up files:", err);
        }
      }
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
  // Backend already exchanges the code for a token and redirects here with ?gh_token=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghToken = params.get("gh_token");
    const ghError = params.get("gh_error");

    if (ghError) {
      toast.error("GitHub authentication failed. Please try again.");
      window.history.replaceState({}, document.title, "/");
      return;
    }

    if (ghToken) {
      const newSettings = { ...settings, githubToken: ghToken };
      setSettings(newSettings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setIsAuthenticated(true);
      setActiveTab("github");
      window.history.replaceState({}, document.title, "/");
      toast.success("GitHub connected!");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch repos automatically once we have a token (covers OAuth callback + page reload)
  useEffect(() => {
    if (settings.githubToken && repos.length === 0) {
      handleFetchRepos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.githubToken]);

  // ── fetchFiles (backend sync) ──
  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5000/api/files");
      if (response.ok) {
        const filesData = await response.json();
        if (filesData && typeof filesData === "object" && !filesData.error) {
          try { localStorage.removeItem(FILES_BACKUP_KEY); } catch {}
          setFiles(filesData);
          setFileTree(buildFileTree(filesData));
          // Mount into WebContainer — this makes refreshFileTree see the new files too
          if (wcRef.current) {
            await wcRef.current.mount(filesToTree(filesData) as any);
            // Now scan WebContainer FS to confirm
            await refreshFileTree();
          }
        }
      }
    } catch {
      console.warn("Backend offline.");
    }
  }, [refreshFileTree]);

  // ── Keep filesRef in sync so bootWebContainer always mounts latest files ──
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // ── Initial load — always fetch from backend so new files show up ──
  useEffect(() => {
    fetchFiles();
  }, []);

  // ── WebContainer boot ──
  const bootWebContainer = useCallback(async () => {
    if (wcRef.current || bootingRef.current) return wcRef.current;
    bootingRef.current = true;
    try {
      const terminal = terminalRef.current;
      terminal?.writeln("\x1b[1;33m⚡ Booting WebContainer...\x1b[0m");
      const wc = await WebContainer.boot();
      wcRef.current = wc;
      // ── Safety net: ensure essential entry-point files exist ──
      // If index.html, main.jsx, or App.jsx are missing (e.g. from a bad
      // GitHub clone or accidental deletion), Vite serves a blank page with
      // no error. Inject the defaults for any that are missing.
      const currentFiles = { ...filesRef.current };
      let injectedDefaults = false;
      const essentialDefaults: Record<string, string> = {
        "index.html": STARTER_FILES["index.html"],
        "src/main.jsx": STARTER_FILES["src/main.jsx"],
        "src/App.jsx": STARTER_FILES["src/App.jsx"],
        "src/App.css": STARTER_FILES["src/App.css"],
        "src/index.css": STARTER_FILES["src/index.css"],
      };
      for (const [path, defaultContent] of Object.entries(essentialDefaults)) {
        if (!currentFiles[path] || currentFiles[path].trim() === "") {
          currentFiles[path] = defaultContent;
          injectedDefaults = true;
        }
      }
      if (injectedDefaults) {
        filesRef.current = currentFiles;
        setFiles(currentFiles);
        terminal?.writeln("\x1b[1;33m⚠ Missing entry file(s) detected — restored defaults (index.html/main.jsx/App.jsx)\x1b[0m");
      }

      await wc.mount(filesToTree(filesRef.current) as any);

      // ── Boot patches — all run in parallel for speed ──
      const viteConfig =
        `const { defineConfig } = require('vite');\n` +
        `const react = require('@vitejs/plugin-react');\n` +
        `module.exports = defineConfig({ plugins: [react()], server: { host: '0.0.0.0' } });\n`;

      const hardhatConfig =
        `module.exports = {\n  solidity: "0.8.19",\n` +
        `  networks: {\n    sepolia: { url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org", accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [] },\n` +
        `    hardhat: { chainId: 1337 }\n  },\n` +
        `  paths: { sources: "./contracts", artifacts: "./artifacts", cache: "./cache" }\n};\n`;

      const claudeRepl =
        `const Anthropic = require('@anthropic-ai/sdk');\nconst readline = require('readline');\n` +
        `const apiKey = process.env.ANTHROPIC_API_KEY || process.argv[2];\n` +
        `if (!apiKey || !apiKey.startsWith('sk-ant-')) { console.error('\\x1b[1;31mError: set ANTHROPIC_API_KEY\\x1b[0m'); process.exit(1); }\n` +
        `const client = new Anthropic({ apiKey, defaultHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' } });\n` +
        `const messages = []; const rl = readline.createInterface({ input: process.stdin, output: process.stdout });\n` +
        `console.log('\\x1b[1;35m╔══════════════════════════════════╗\\x1b[0m');\n` +
        `console.log('\\x1b[1;35m║   Claude Terminal — Zicon IDE    ║\\x1b[0m');\n` +
        `console.log('\\x1b[1;35m╚══════════════════════════════════╝\\x1b[0m\\n');\n` +
        `const ask = () => { rl.question('\\x1b[1;36mYou: \\x1b[0m', async (input) => {\n` +
        `  if (!input.trim()) return ask(); messages.push({ role: 'user', content: input });\n` +
        `  console.log('\\x1b[90mThinking...\\x1b[0m');\n` +
        `  try { const r = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 2048, messages });\n` +
        `    const reply = r.content[0].text; messages.push({ role: 'assistant', content: reply });\n` +
        `    console.log('\\x1b[1;35mClaude:\\x1b[0m ' + reply + '\\n');\n` +
        `  } catch(e) { console.error('\\x1b[1;31mError: ' + e.message + '\\x1b[0m'); } ask(); }); }; ask();\n`;

      await Promise.all([
        // Patch package.json (must be sequential: read then write)
        (async () => {
          try {
            const pkgRaw = await wc.fs.readFile("package.json", "utf-8");
            const pkg = JSON.parse(pkgRaw);
            let patched = false;
            if (pkg.devDependencies?.vite && !pkg.devDependencies.vite.startsWith("^4")) { pkg.devDependencies.vite = "^4.5.3"; patched = true; }
            if (pkg.devDependencies?.["@vitejs/plugin-react"]?.startsWith("^5")) { pkg.devDependencies["@vitejs/plugin-react"] = "^4.2.1"; patched = true; }
            if (pkg.type === "module") { delete pkg.type; patched = true; }
            if (patched) {
              await wc.fs.writeFile("package.json", JSON.stringify(pkg, null, 2));
              terminal?.writeln("\x1b[1;32m✓ Patched package.json → Vite 4.5.3\x1b[0m");
            }
          } catch {}
        })(),
        // Delete stale lock + write config files (all independent, run in parallel)
        wc.fs.rm("package-lock.json").catch(() => {}),
        wc.fs.rm("vite.config.js").catch(() => {}),
        wc.fs.rm("vite.config.ts").catch(() => {}),
        wc.fs.writeFile(".npmrc", "audit=false\nfund=false\nprefer-offline=true\nloglevel=error\n").catch(() => {}),
        wc.fs.writeFile("vite.config.cjs", viteConfig).catch(() => {}),
        wc.fs.writeFile("hardhat.config.cjs", hardhatConfig).catch(() => {}),
        wc.fs.writeFile("claude-repl.cjs", claudeRepl).catch(() => {}),
        wc.fs.mkdir("contracts").catch(() => {}),
      ]);

      terminal?.writeln("\x1b[1;32m✓ Config files ready\x1b[0m");

      wc.on("server-ready", (_port: number, url: string) => {
        setPreviewUrl(url);
        setIsLoading(false);
        setLoadingStage("Booting WebContainer...");
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
    setLoadingStage("Booting WebContainer...");
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

      // Watch output for the WebContainer Vite crash signature and auto-retry
      let autoRetried = false;
      shellProcess.output.pipeTo(new WritableStream({
        write(data) {
          terminal?.write(data);
          // Detect the known WebContainer ESM resolver crash on first Vite boot
          if (!autoRetried && data.includes("decorateErrorWithCommonJSHints")) {
            autoRetried = true;
            terminal?.writeln("\x1b[1;33m⚠ Vite startup glitch — auto-restarting dev server...\x1b[0m");
            setTimeout(async () => {
              try {
                await shellInputRef.current?.write("npm run dev\n");
              } catch { /* shell gone */ }
            }, 1500);
          }
        }
      }));

      const input = shellProcess.input.getWriter();
      shellInputRef.current = input;
      terminalListenerRef.current = terminal?.onData((data: string) => { try { input.write(data); } catch { /* stream closed after process exit */ } });
      terminal?.writeln("\x1b[1;34m[Zicon] Shell ready. Type commands or use npm run dev\x1b[0m\r\n");

      // Auto-run for web projects — skip npm install if node_modules already
      // exists (e.g. Stop → Run again in the same session keeps the WebContainer
      // FS warm, so re-running is near-instant instead of re-downloading deps)
      if (!isPython && !isNode && !isSolidity) {
        setTimeout(async () => {
          let hasNodeModules = false;
          try {
            const entries = await wc.fs.readdir("node_modules");
            hasNodeModules = entries.length > 0;
          } catch {
            hasNodeModules = false;
          }

          if (hasNodeModules) {
            terminal?.writeln("\x1b[1;32m✓ Dependencies already installed — starting dev server...\x1b[0m");
            setLoadingStage("Starting dev server...");
            await input.write("npm run dev\n");
          } else {
            terminal?.writeln("\x1b[1;33m📦 Installing dependencies (first run only)...\x1b[0m");
            setLoadingStage("Installing dependencies — first run takes ~30-60s...");
            await input.write("pnpm install --prefer-offline 2>/dev/null || npm install --no-audit --no-fund && npm run dev\n");
          }
        }, 500);
      } else {
        setLoadingStage("Starting...");
      }

      shellProcess.exit.then(async (code: number) => {
        if (code !== 0) {
          // Process crashed — check if node_modules is already there
          // (i.e. npm install completed but vite startup failed)
          let hasNodeModules = false;
          try {
            const entries = await wc?.fs.readdir("node_modules");
            hasNodeModules = (entries?.length ?? 0) > 0;
          } catch { hasNodeModules = false; }

          if (hasNodeModules && shellInputRef.current) {
            // Auto-retry: second run always works since deps are installed
            terminal?.writeln("\x1b[1;33m⚠ Dev server crashed — auto-restarting in 2s...\x1b[0m");
            setTimeout(async () => {
              try {
                await shellInputRef.current?.write("npm run dev\n");
                terminal?.writeln("\x1b[1;32m↺ Restarted!\x1b[0m");
              } catch { /* shell gone, ignore */ }
            }, 2000);
            return; // don't mark as stopped — we're retrying
          }
        }
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
      terminalListenerRef.current = terminal?.onData((data: string) => { try { input.write(data); } catch { /* stream closed after process exit */ } });
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

      // Sync owned extensions from backend — ownership is tied to THIS wallet,
      // not a generic browser-wide key. Switching wallets must show that
      // wallet's actual purchases, not whatever was last cached.
      fetchOwnedExtensions(address);
    } catch (err: any) {
      if (err.code === 4001) toast.error("Connection rejected by user.");
      else toast.error("Wallet connection failed.");
    }
  };

  // ── Fetch owned extensions for a specific wallet from backend ──
  const fetchOwnedExtensions = useCallback(async (address: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/extensions/owned/${address}`);
      if (res.ok) {
        const data = await res.json();
        const owned = data.owned || [];
        setOwnedExtensions(owned);
        // Cache per-wallet so a refresh before backend responds still shows correct state
        localStorage.setItem(`${EXTENSIONS_KEY}:${address.toLowerCase()}`, JSON.stringify(owned));
      }
    } catch {
      // Backend offline — fall back to this wallet's cached extensions, not the generic key
      const cached = localStorage.getItem(`${EXTENSIONS_KEY}:${address.toLowerCase()}`);
      if (cached) {
        try { setOwnedExtensions(JSON.parse(cached)); } catch {}
      }
    }
  }, []);

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    setWalletBalance(null);
    setIsWrongNetwork(false);
    setOwnedExtensions([]); // extensions are tied to the wallet, not the browser session
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
          if (walletAddress) {
            localStorage.setItem(`${EXTENSIONS_KEY}:${walletAddress.toLowerCase()}`, JSON.stringify(updated));
          }
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
    if (!wcRef.current) {
      toast.error("WebContainer not running", {
        description: "Click Run first to boot the IDE, then try again.",
        duration: 6000,
      });
      return;
    }
    const terminal = terminalRef.current;

    // Long-running server commands (hardhat node, npm run dev etc.)
    // must run in the FOREGROUND shell, not a background jsh -c process
    const isServerCommand = command.includes("hardhat node") ||
      command.includes("npm run") || command.includes("node claude-repl");

    if (isServerCommand && shellInputRef.current) {
      terminal?.writeln(`\r\n\x1b[1;35m[Extension] Sending to foreground shell...\x1b[0m`);
      terminal?.writeln(`\x1b[90m$ ${command.split("&&").pop()?.trim()}\x1b[0m`);
      shellInputRef.current.write(`${command}\n`).catch(() => {});
      toast.info(instructions || `Running: ${command}`, { duration: 6000 });
      return;
    }

    // Short installs — background shell (keeps dev server running)
    terminal?.writeln(`\r\n\x1b[1;35m[Extension] Spawning background shell for install...\x1b[0m`);
    terminal?.writeln(`\x1b[90m$ ${command}\x1b[0m`);

    wcRef.current.spawn("jsh", ["-c", command]).then((proc) => {
      proc.output.pipeTo(new WritableStream({
        write(data) { terminal?.write(data); }
      }));
      proc.exit.then((code) => {
        if (code === 0) {
          terminal?.writeln(`\x1b[1;32m✓ Done!\x1b[0m`);
          toast.success("Done!", { description: instructions, duration: 8000 });
        } else {
          terminal?.writeln(`\x1b[1;31m✗ Exited with code ${code}\x1b[0m`);
          toast.error("Failed — check the terminal for details.");
        }
      });
    }).catch(() => {
      toast.error("Failed to spawn shell — is WebContainer running?");
    });

    toast.info("Running in background...", {
      description: "Dev server stays running. Watch the terminal for progress.",
      duration: 5000,
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
        // Backend returns paths relative to the clone root (e.g. "src/App.jsx"),
        // not prefixed with the repo name. Prefix them here and MERGE into the
        // existing files instead of replacing — otherwise cloning wipes out
        // every other project/contract/artifact currently open in the IDE.
        const prefixed: Record<string, string> = {};
        for (const [relPath, content] of Object.entries(data.files as Record<string, string>)) {
          prefixed[`${data.repoName}/${relPath}`] = content;
        }
        const mergedFiles = { ...filesRef.current, ...prefixed };
        setFiles(mergedFiles);
        setFileTree(buildFileTree(mergedFiles));
        setCurrentRepoUrl(repoUrl);
        setCurrentRepoName(data.repoName);
        if (wcRef.current) {
          await wcRef.current.mount(filesToTree(mergedFiles) as any);
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
      const response = await fetch("http://localhost:5000/api/github/repos", {
        headers: { Authorization: `Bearer ${settings.githubToken}` },
      });
      const data = await response.json();
      if (data.success) setRepos(data.repos);
      else toast.error(data.message || "Failed to fetch repos");
    } catch {
      toast.error("Could not connect to backend. Is server.js running?");
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

  const handlePull = useCallback(async () => {
    if (!currentRepoUrl) return toast.error("No repository linked. Clone a project first.");
    const loadingToast = toast.loading("Pulling latest changes...");
    try {
      const res = await fetch("http://localhost:5000/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoName: currentRepoName,
          repoUrl: currentRepoUrl,
          token: settings.githubToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Same fix as clone — backend returns paths relative to the repo root,
        // prefix + merge instead of replacing every open file in the IDE.
        const prefixed: Record<string, string> = {};
        for (const [relPath, content] of Object.entries(data.files as Record<string, string>)) {
          prefixed[`${currentRepoName}/${relPath}`] = content;
        }
        const mergedFiles = { ...filesRef.current, ...prefixed };
        setFiles(mergedFiles);
        setFileTree(buildFileTree(mergedFiles));
        if (wcRef.current) {
          await wcRef.current.mount(filesToTree(mergedFiles) as any);
        }
        await refreshFileTree();
        toast.success("Pulled latest changes!", { id: loadingToast });
      } else {
        toast.error(data.message || "Pull failed", { id: loadingToast });
      }
    } catch {
      toast.error("Could not connect to backend.", { id: loadingToast });
    }
  }, [currentRepoUrl, currentRepoName, settings.githubToken, refreshFileTree]);

  const handleGitCommit = async () => {
    if (!settings.githubToken) return toast.error("Connect GitHub first", {
      description: "Click 'Connect GitHub' in the top bar to authenticate.",
    });
    if (!currentRepoUrl) return toast.error("No repository linked", {
      description: "Clone a repo first from the GitHub Repos panel.",
    });

    // Inline commit message — show a toast with an input instead of browser prompt()
    toast.custom((t) => (
      <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-4 shadow-xl w-80">
        <p className="text-sm font-semibold text-white mb-1">Commit message</p>
        <p className="text-[11px] text-[#858585] mb-3">Pushing to {currentRepoName}</p>
        <input
          id="commit-msg-input"
          autoFocus
          defaultValue={`Update from Zicon IDE — ${new Date().toLocaleTimeString()}`}
          className="w-full bg-[#1e1e1e] border border-[#3E3E42] focus:border-[#007ACC] rounded px-2 py-1.5 text-sm text-white outline-none mb-3"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const msg = (document.getElementById("commit-msg-input") as HTMLInputElement)?.value?.trim();
              if (!msg) return;
              toast.dismiss(t);
              doPush(msg);
            }
            if (e.key === "Escape") toast.dismiss(t);
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              const msg = (document.getElementById("commit-msg-input") as HTMLInputElement)?.value?.trim();
              if (!msg) return;
              toast.dismiss(t);
              doPush(msg);
            }}
            className="flex-1 bg-[#007ACC] hover:bg-[#005a9e] text-white text-xs py-1.5 rounded transition-colors font-semibold"
          >
            Push
          </button>
          <button
            onClick={() => toast.dismiss(t)}
            className="px-3 bg-[#3E3E42] hover:bg-[#555] text-white text-xs py-1.5 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 60000 });
  };

  const doPush = async (commitMessage: string) => {
    const loadingToast = toast.loading("Pushing to GitHub...");
    try {
      const response = await fetch("http://localhost:5000/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          token: settings.githubToken,
          repoName: currentRepoName,
          repoUrl: currentRepoUrl,
          commitMessage,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`Pushed to ${data.branch}!`, {
          id: loadingToast,
          description: commitMessage,
        });
      } else {
        toast.error("Push failed: " + data.message, { id: loadingToast });
      }
    } catch {
      toast.error("Could not connect to backend.", { id: loadingToast });
    }
  };

  // ── GitHub: fork a repo from the repo list into your own account ──
  const handleForkRepo = useCallback(async (fullName: string) => {
    if (!settings.githubToken) return toast.error("Connect GitHub first");
    const loadingToast = toast.loading(`Forking ${fullName}...`);
    try {
      const res = await fetch("http://localhost:5000/api/github/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, token: settings.githubToken }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Forked to ${data.repo.fullName}!`, {
          id: loadingToast,
          description: "Added to your repo list — click Clone to start editing.",
        });
        setRepos((prev) => [data.repo, ...prev.filter((r) => r.fullName !== data.repo.fullName)]);
      } else {
        toast.error(data.message || "Fork failed", { id: loadingToast });
      }
    } catch {
      toast.error("Could not connect to backend.", { id: loadingToast });
    }
  }, [settings.githubToken]);

  // ── GitHub: create a brand new repo ──
  const handleCreateRepo = useCallback(async () => {
    if (!settings.githubToken) return toast.error("Connect GitHub first");
    const name = prompt("New repository name:");
    if (!name || !name.trim()) return;
    const isPrivate = confirm("Make this repo private?\n\nOK = Private, Cancel = Public");

    const loadingToast = toast.loading(`Creating ${name}...`);
    try {
      const res = await fetch("http://localhost:5000/api/github/create-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), isPrivate, token: settings.githubToken }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Created ${data.repo.fullName}!`, {
          id: loadingToast,
          description: data.repo.private ? "Private repo" : "Public repo",
        });
        setRepos((prev) => [data.repo, ...prev]);
      } else {
        toast.error(data.message || "Repo creation failed", { id: loadingToast });
      }
    } catch {
      toast.error("Could not connect to backend.", { id: loadingToast });
    }
  }, [settings.githubToken]);

  // ── FIX: Extensions — Sepolia testnet mock payment that persists ──
  const handleInstallExtension = async (extId: string, isPaid: boolean) => {
    const ext = EXTENSION_REGISTRY.find((e) => e.id === extId);
    if (!ext) return toast.error("Extension not found.");

    // Uninstall toggle
    if (ownedExtensions.includes(extId)) {
      const updated = ownedExtensions.filter((id) => id !== extId);
      setOwnedExtensions(updated);
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

      const updatedExtensions = [...ownedExtensions, extId];
      setOwnedExtensions(updatedExtensions);

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

    // Get keys — settings → localStorage → prompt user
    const aiKey = localStorage.getItem("zicon-anthropic-key") || "";
    let groqKey = settings.geminiKey || localStorage.getItem("zicon-groq-key") || "";
    if (!groqKey) {
      const entered = prompt("Enter your free Groq API key for AI audit.\nGet one free (no card) at console.groq.com/keys\n\nLeave blank for a basic scan.");
      if (entered?.trim().startsWith("gsk_")) {
        groqKey = entered.trim();
        localStorage.setItem("zicon-groq-key", groqKey);
        const newSettings = { ...settings, geminiKey: groqKey };
        setSettings(newSettings);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
        toast.success("Groq key saved!");
      }
    }

    const toastId = toast.loading("Zicon Sentinel: Analyzing contract...");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const message = `Authorize Zicon Security Scan for ${activeFile}`;
      const signature = await signer.signMessage(message);

      const res = await fetch("http://localhost:5000/api/audit-solidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress, signature, message, content: files[activeFile], aiKey, geminiKey: groqKey }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server error ${res.status}`);
      }
      const data = await res.json();
      toast.dismiss(toastId);
      if (!data.success) { toast.error(data.message || "Audit failed."); return; }

      if (data.aiAudit) {
        // AI audit result — show in a rich toast panel
        const audit = data.aiAudit;
        const severityColor = { CRITICAL: "#F44747", HIGH: "#D97757", MEDIUM: "#DCDCAA", LOW: "#4EC9B0", CLEAR: "#4EC9B0", INFO: "#858585" };
        const overallColor = severityColor[audit.severity as keyof typeof severityColor] || "#858585";
        toast.custom(() => (
          <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-4 shadow-2xl w-[420px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: overallColor }} className="text-lg">🛡️</span>
              <div>
                <p className="text-white font-bold text-sm">Zicon Sentinel — {data.engine || 'AI'} Audit</p>
                <p className="text-[10px]" style={{ color: overallColor }}>{audit.severity} — {audit.summary}</p>
              </div>
            </div>
            {audit.findings?.length > 0 ? (
              <div className="space-y-2">
                {audit.findings.map((f: any, i: number) => (
                  <div key={i} className="border border-[#3E3E42] rounded p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: (severityColor[f.severity as keyof typeof severityColor] || "#555") + "22", color: severityColor[f.severity as keyof typeof severityColor] || "#858585" }}>
                        {f.severity}
                      </span>
                      <span className="text-xs font-semibold text-white">{f.title}</span>
                    </div>
                    <p className="text-[11px] text-[#CCCCCC] mb-1">{f.description}</p>
                    <p className="text-[10px] text-[#4EC9B0]">→ {f.recommendation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-green-400 text-2xl mb-1">✅</p>
                <p className="text-sm text-[#CCCCCC]">No vulnerabilities found</p>
                <p className="text-[10px] text-[#555]">Contract passed AI security analysis</p>
              </div>
            )}
          </div>
        ), { duration: 30000 });
      } else {
        // Basic scan fallback
        data.reports.forEach((msg: string) => {
          msg.includes("✅") ? toast.success(msg) : msg.includes("🚨") ? toast.error(msg, { duration: 8000 }) : toast.warning(msg, { duration: 6000 });
        });
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      if (err.code === 4001 || err.message?.includes("rejected")) toast.error("Signature denied.");
      else toast.error("Audit error: " + (err.message || "Unknown error"));
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

  const handleDeploy = useCallback(async (network: "sepolia" | "local" = "sepolia") => {
    if (network === "sepolia" && !walletAddress) return toast.error("Connect your wallet first.");
    if (network === "sepolia" && isWrongNetwork) return toast.error("Switch to Sepolia testnet first.");
    if (!wcRef.current) {
      const wc = await bootWebContainer();
      if (!wc) return toast.error("Failed to boot WebContainer.");
    }

    // Find compiled artifacts
    let artifacts: { name: string; abi: any[]; bytecode: string }[] = [];
    try {
      const artifactFiles = await wcRef.current.fs.readdir("artifacts");
      for (const f of artifactFiles.filter((f: string) => f.endsWith(".json"))) {
        const raw = await wcRef.current.fs.readFile(`artifacts/${f}`, "utf-8");
        const art = JSON.parse(raw);
        if (art.abi && art.bytecode) artifacts.push({ name: art.contractName || f.replace(".json", ""), abi: art.abi, bytecode: art.bytecode });
      }
    } catch {
      return toast.error("No compiled artifacts found. Click ⚒ Compile first.");
    }
    if (!artifacts.length) return toast.error("No compiled contracts found. Click ⚒ Compile first.");

    // Pick contract if multiple
    let artifact = artifacts[0];
    if (artifacts.length > 1) {
      const names = artifacts.map(a => a.name).join(", ");
      const chosen = prompt(`Multiple contracts: ${names}\n\nEnter contract name to deploy:`);
      if (!chosen) return;
      artifact = artifacts.find(a => a.name.toLowerCase() === chosen.toLowerCase()) || artifact;
    }

    // Constructor params
    const constructorAbi = artifact.abi.find((x: any) => x.type === "constructor");
    const constructorArgs: any[] = [];
    if (constructorAbi?.inputs?.length > 0) {
      for (const input of constructorAbi.inputs) {
        const val = prompt(`Constructor param: ${input.name} (${input.type})`);
        if (val === null) return;
        constructorArgs.push(val);
      }
    }

    const label = network === "local" ? "Hardhat Node (localhost:8545)" : "Sepolia";
    const toastId = toast.loading(`Deploying ${artifact.name} to ${label}...`);
    try {
      let signer;
      if (network === "local") {
        // Connect to local Hardhat node — use first pre-funded account
        const localProvider = new ethers.JsonRpcProvider("http://localhost:8545");
        const accounts = await localProvider.listAccounts();
        if (!accounts.length) throw new Error("No accounts found — is Hardhat Node running on localhost:8545?");
        signer = await localProvider.getSigner(0);
      } else {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        signer = await provider.getSigner();
      }

      const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
      const contract = await factory.deploy(...constructorArgs);
      toast.loading("Waiting for confirmation...", { id: toastId });
      await contract.deploymentTransaction()?.wait();
      const address = await contract.getAddress();
      toast.dismiss(toastId);

      toast.custom(() => (
        <div className="bg-[#252526] border border-green-900/50 rounded-lg p-4 shadow-xl w-[380px]">
          <p className="text-green-400 font-bold text-sm mb-1">✅ {artifact.name} deployed!</p>
          <p className="text-[10px] text-[#858585] mb-1">Network: <span className="text-white">{label}</span></p>
          <p className="text-[11px] text-[#858585] mb-2">Contract Address:</p>
          <p className="text-[11px] text-white font-mono bg-[#1e1e1e] rounded px-2 py-1.5 mb-3 break-all">{address}</p>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(address)} className="flex-1 bg-[#3E3E42] hover:bg-[#555] text-white text-xs py-1.5 rounded transition-colors">Copy Address</button>
            {network === "sepolia" && (
              <a href={`https://sepolia.etherscan.io/address/${address}`} target="_blank" rel="noreferrer" className="flex-1 bg-[#007ACC] hover:bg-[#005a9e] text-white text-xs py-1.5 rounded transition-colors text-center">Etherscan ↗</a>
            )}
          </div>
        </div>
      ), { duration: 60000 });
    } catch (err: any) {
      toast.dismiss(toastId);
      if (err.code === 4001) toast.error("Deployment rejected.");
      else toast.error("Deploy failed: " + (err.reason || err.message?.slice(0, 100)));
    }
  }, [walletAddress, isWrongNetwork]);

  const handleCompile = async () => {
    if (!wcRef.current) {
      const terminal = terminalRef.current;
      terminal?.writeln("\x1b[1;33m⚡ Booting WebContainer...\x1b[0m");
      const wc = await bootWebContainer();
      if (!wc) return toast.error("Failed to boot WebContainer.");
      try {
        const shellProcess = await wc.spawn("jsh", { terminal: { cols: 80, rows: 24 } });
        processRef.current = shellProcess;
        shellProcess.output.pipeTo(new WritableStream({ write(data) { terminal?.write(data); } }));
        const input = shellProcess.input.getWriter();
        shellInputRef.current = input;
        terminalListenerRef.current = terminal?.onData((data: string) => { try { input.write(data); } catch {} });
        terminal?.writeln("\x1b[1;32m✓ Terminal ready\x1b[0m\r\n");
        setIsRunning(true);
      } catch {}
    }
    const terminal = terminalRef.current;
    const toastId = toast.loading("Setting up Solidity compiler...");

    try {
      // Write a standalone compile script using solc (pure JS, no native addons)
      const compileScript = `
const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractsDir = './contracts';
if (!fs.existsSync(contractsDir)) { console.error('No contracts/ folder found.'); process.exit(1); }

// Recursively find all .sol files in contracts/ and subfolders
function findSolFiles(dir, base) {
  base = base || dir;
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(findSolFiles(full, base));
    } else if (item.endsWith('.sol')) {
      results.push({ fullPath: full, relativePath: path.relative(base, full).replace(/\\\\/g, '/') });
    }
  }
  return results;
}

const solFiles = findSolFiles(contractsDir);
const files = solFiles.map(f => f.relativePath);
if (!files.length) { console.error('No .sol files found in contracts/'); process.exit(1); }

console.log('Compiling', files.length, 'contract(s)...');

const input = {
  language: 'Solidity',
  sources: {},
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } } }
};
files.forEach((f, i) => {
  const fullPath = solFiles[i].fullPath;
  input.sources[f] = { content: fs.readFileSync(fullPath, 'utf8') };
});

// Resolver — handles @openzeppelin and other node_modules imports
function findImport(importPath) {
  const searchPaths = [
    path.join('./node_modules', importPath),
    path.join(contractsDir, importPath),
    path.join('.', importPath),
  ];
  for (const p of searchPaths) {
    if (fs.existsSync(p)) return { contents: fs.readFileSync(p, 'utf8') };
  }
  return { error: 'File not found: ' + importPath };
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
let hasError = false;
(output.errors || []).forEach(e => {
  if (e.severity === 'error') {
    // If OpenZeppelin not installed, give a helpful message
    if (e.message.includes('not found') && e.message.includes('@openzeppelin')) {
      console.error('\\x1b[33m⚠ OpenZeppelin not installed. Run: npm install @openzeppelin/contracts\\x1b[0m');
    } else {
      console.error('\\x1b[31m' + e.formattedMessage + '\\x1b[0m');
    }
    hasError = true;
  } else {
    console.warn('\\x1b[33m' + e.formattedMessage + '\\x1b[0m');
  }
});
if (hasError) process.exit(1);

fs.mkdirSync('./artifacts', { recursive: true });
let count = 0;
for (const [, contracts] of Object.entries(output.contracts || {})) {
  for (const [name, contract] of Object.entries(contracts)) {
    const artifact = {
      contractName: name,
      abi: contract.abi,
      bytecode: '0x' + contract.evm.bytecode.object,
      deployedBytecode: '0x' + contract.evm.deployedBytecode.object
    };
    fs.writeFileSync('./artifacts/' + name + '.json', JSON.stringify(artifact, null, 2));
    console.log('\\x1b[32m✓ ' + name + '\\x1b[0m → artifacts/' + name + '.json');
    count++;
  }
}
console.log('\\n\\x1b[1;32m✅ Compiled ' + count + ' contract(s) successfully!\\x1b[0m');
`;
      await wcRef.current.fs.writeFile("_compile.cjs", compileScript);

      // Install solc and OpenZeppelin if needed
      let solcInstalled = false;
      let ozInstalled = false;
      try {
        const nm = await wcRef.current.fs.readdir("node_modules");
        solcInstalled = nm.includes("solc");
        ozInstalled = nm.includes("@openzeppelin");
      } catch {}

      // Check if any contract imports OpenZeppelin by reading from WebContainer FS
      let needsOZ = false;
      if (!ozInstalled) {
        try {
          const checkProc = await wcRef.current.spawn("grep", ["-r", "@openzeppelin", "./contracts"]);
          const code = await checkProc.exit;
          needsOZ = code === 0;
        } catch {
          needsOZ = true; // assume yes if grep fails
        }
      }

      if (!solcInstalled) {
        terminal?.writeln("\x1b[1;33m📦 Installing solc (pure JS Solidity compiler)...\x1b[0m");
        toast.loading("Installing solc...", { id: toastId });
        const installProc = await wcRef.current.spawn("npm", ["install", "--no-audit", "--no-fund", "solc", "@openzeppelin/contracts"]);
        installProc.output.pipeTo(new WritableStream({ write(data) { terminal?.write(data); } }));
        const code = await installProc.exit;
        if (code !== 0) { toast.error("solc install failed", { id: toastId }); return; }
      } else if (!ozInstalled) {
        terminal?.writeln("\x1b[1;33m📦 Installing @openzeppelin/contracts...\x1b[0m");
        const ozProc = await wcRef.current.spawn("npm", ["install", "--no-audit", "--no-fund", "@openzeppelin/contracts"]);
        ozProc.output.pipeTo(new WritableStream({ write(data) { terminal?.write(data); } }));
        await ozProc.exit;
      }

      // Run compile script
      terminal?.writeln("\x1b[1;36m[Solidity] Compiling contracts...\x1b[0m");
      toast.loading("Compiling...", { id: toastId });
      const compileProc = await wcRef.current.spawn("node", ["_compile.cjs"]);
      compileProc.output.pipeTo(new WritableStream({ write(data) { terminal?.write(data); } }));
      const exitCode = await compileProc.exit;

      if (exitCode === 0) {
        toast.success("✅ Compiled successfully!", { id: toastId });
        await syncVirtualFilesToState();
        await refreshFileTree();
      } else {
        toast.error("Compilation failed — check terminal for errors.", { id: toastId });
      }
    } catch (err: any) {
      toast.error("Compile error: " + err.message, { id: toastId });
      terminal?.writeln(`\x1b[1;31m[Error] ${err.message}\x1b[0m`);
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

  const handleFork = useCallback(async () => {
    if (!settings.githubToken) return toast.error("Connect GitHub first to fork repos.");

    if (!currentRepoUrl) {
      // No GitHub repo linked — nothing to fork, just offer a local rename
      const newName = prompt("No repo linked. Enter a name for your local copy:", `${currentRepoName}-copy`);
      if (!newName) return;
      setCurrentRepoName(newName);
      toast.success(`Renamed local project to ${newName}`);
      return;
    }

    // Extract owner/repo from the current repo URL
    const match = currentRepoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) return toast.error("Could not parse owner/repo from the linked URL.");
    const fullName = `${match[1]}/${match[2]}`;

    const loadingToast = toast.loading(`Forking ${fullName}...`);
    try {
      const res = await fetch("http://localhost:5000/api/github/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, token: settings.githubToken }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Fork failed", { id: loadingToast });
        return;
      }
      toast.success(`Forked to ${data.repo.fullName}! Cloning your copy...`, { id: loadingToast });
      setRepos((prev) => [data.repo, ...prev.filter((r) => r.fullName !== data.repo.fullName)]);
      // Switch to working on the fork
      await handleGithubClone(data.repo.cloneUrl);
    } catch {
      toast.error("Could not connect to backend.", { id: loadingToast });
    }
  }, [settings.githubToken, currentRepoUrl, currentRepoName, handleGithubClone]);

  const handleSettingsUpdate = useCallback((newSettings: EditorSettings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
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
        const prefixed: Record<string, string> = {};
        for (const [relPath, content] of Object.entries(data.files as Record<string, string>)) {
          prefixed[`${projectName}/${relPath}`] = content;
        }
        const mergedFiles = { ...filesRef.current, ...prefixed };
        setFiles(mergedFiles);
        setFileTree(buildFileTree(mergedFiles));
        setCurrentRepoName(projectName);
        const solFiles = Object.keys(prefixed).filter((f) => f.endsWith(".sol"));
        if (solFiles.length > 0) { setActiveFile(solFiles[0]); setOpenFiles(solFiles); }
        if (wcRef.current) {
          for (const [path, content] of Object.entries(prefixed)) {
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
        onPull={handlePull}
        onCommit={handleGitCommit}
        onPatSave={(token) => {
          const newSettings = { ...settings, githubToken: token };
          setSettings(newSettings);
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
          setIsAuthenticated(true);
          toast.success("GitHub PAT saved!", { description: "You can now push, pull and fork." });
        }}
        onOpenFolder={handleOpenFolder}
        onAudit={handleAuditCode}
        onCompile={handleCompile}
        onDeploy={handleDeploy}
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
            onRefreshFiles={() => {
              localStorage.removeItem('ide_files_backup');
              window.location.reload();
            }}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            repos={repos}
            onClone={handleGithubClone}
            onFetchRepos={handleFetchRepos}
            onForkRepo={handleForkRepo}
            onCreateRepo={handleCreateRepo}
            onGitHubLogin={handleGithubLogin}
            onInstallExtension={(id, price) => handleInstallExtension(id, true)}
            isFetchingRepos={isFetchingRepos}
            ownedExtensions={ownedExtensions}
            extensionRegistry={EXTENSION_REGISTRY}
            // ── Web3 props ──
            walletAddress={walletAddress}
            checkOwnership={checkOwnership}
            onOpenMarketplace={() => setShowMarketplace(true)}
            onOpenAIChat={() => setShowAIChat(true)}
            onOpenCollab={() => setShowCollab(true)}
          />
        </ResizablePanel>

        <ResizableHandle className="w-[1px] bg-[#3E3E42] hover:bg-[#007ACC] transition-colors" />

        <ResizablePanel defaultSize={42}>
          <div className="relative h-full">
            {/* Always-mounted Editor + Terminal (kept alive underneath any overlay) */}
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
              {/* Terminal — ALWAYS mounted, never unmounted even when overlay is shown */}
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
                      {/* Paste from clipboard */}
                      <button
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text && shellInputRef.current) {
                              await shellInputRef.current.write(text);
                            }
                          } catch {
                            toast.error("Clipboard access denied — use Ctrl+Shift+V instead");
                          }
                        }}
                        className="text-[#555] hover:text-white text-[10px] px-1.5 py-0.5 hover:bg-[#333] rounded transition-colors"
                        title="Paste from clipboard (or use Ctrl+Shift+V)"
                      >
                        📋 Paste
                      </button>
                      {/* One-click dev server restart — skips npm install since node_modules is warm */}
                      <button
                        onClick={async () => {
                          if (!shellInputRef.current) {
                            await handleRestartTerminal();
                            setTimeout(async () => {
                              try { await shellInputRef.current?.write("npm run dev\n"); } catch {}
                            }, 800);
                          } else {
                            try { await shellInputRef.current.write("npm run dev\n"); } catch {
                              await handleRestartTerminal();
                              setTimeout(async () => {
                                try { await shellInputRef.current?.write("npm run dev\n"); } catch {}
                              }, 800);
                            }
                          }
                        }}
                        className="text-[9px] text-green-400 hover:text-white px-1.5 py-0.5 hover:bg-[#333] rounded transition-colors border border-green-900/40 hover:border-[#555]"
                        title="Send 'npm run dev' to terminal (fast restart — skips install)"
                      >
                        ▶ Dev Server
                      </button>
                      <button
                        onClick={handleRestartTerminal}
                        className="text-[#555] hover:text-white text-[10px] px-1.5 py-0.5 hover:bg-[#333] rounded transition-colors ml-1"
                        title="Restart shell"
                      >
                        ↺ Shell
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <TerminalPanel
                      onTerminalReady={handleTerminalReady}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>

            {/* Overlay: Marketplace / AI Chat — takes FULL column height, Editor+Terminal stay alive behind it */}
            {(showMarketplace || showAIChat || showCollab) && (
              <div className="absolute inset-0 z-20 bg-[#1e1e1e]">
                {showAIChat ? (
                  <AIAssistant
                    onClose={() => setShowAIChat(false)}
                    activeFileName={activeFile}
                    activeFileContent={files[activeFile] || ""}
                  />
                ) : showCollab ? (
                  <div className="h-full flex flex-col overflow-hidden">
                    <div className="h-9 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-4 shrink-0">
                      <span className="text-xs text-[#858585] uppercase tracking-wider font-semibold">Team Session</span>
                      <button onClick={() => setShowCollab(false)} className="text-[#555] hover:text-white text-xs px-2 py-1 hover:bg-[#333] rounded transition-colors">✕ Close</button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <CollabUsers walletAddress={walletAddress} onConnectWallet={handleConnectWallet} />
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-[1px] bg-[#3E3E42] hover:bg-[#007ACC] transition-colors" />

        <ResizablePanel defaultSize={40}>
          <PreviewPanel previewUrl={previewUrl} isLoading={isLoading} loadingStage={loadingStage} />
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
