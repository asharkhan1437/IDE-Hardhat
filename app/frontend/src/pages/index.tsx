  import { useState, useCallback, useRef, useEffect } from "react";
  import { WebContainer } from "@webcontainer/api";
  import type { Terminal as XTerminal } from "@xterm/xterm";
  import JSZip from "jszip";
  import { saveAs } from "file-saver";
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
  import type { EditorSettings } from "@/components/SettingsDialog";

  // ── Starter project files (Updated with Hardhat Support) ──
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
          // Added this so the terminal can run compilation
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
    
    // 1. HARDHAT CONFIG (Required for the extension to actually work)
    "hardhat.config.cjs": `module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      chainId: 1337
    }
  }
};`,

    // 2. SAMPLE SMART CONTRACT
    "contracts/ZiconToken.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ZiconToken {
    string public name = "Zicon Token";
    string public symbol = "ZIC";
    uint256 public totalSupply = 1000000 * 10**18;

    mapping(address => uint256) public balances;

    constructor() {
        balances[msg.sender] = totalSupply;
    }

    function getBalance(address account) public view returns (uint256) {
        return balances[account];
    }
}`,

    "vite.config.js": `import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
  });`,
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
    <React.StrictMode>
      <App />
    </React.StrictMode>
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
          <p style={{marginTop: '10px', color: '#4EC9B0', fontSize: '0.8rem'}}>
            Hardhat Extension ready for Smart Contracts
          </p>
        </header>
        <div className="card">
          <button onClick={() => setCount(c => c + 1)}>
            Count: {count}
          </button>
        </div>
      </div>
    );
  }

  export default App;`,
    "src/App.css": `.app {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .header h1 {
    font-size: 2.5rem;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header p { color: #666; margin-top: 0.5rem; }
  code { background: #f0f0f0; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.9rem; }
  .card { margin-top: 2rem; }
  .card button {
    padding: 0.8rem 1.6rem;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .card button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }`,
    "src/index.css": `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fafafa; }`,
  };

  // ── 2. ADD MARKETPLACE REGISTRY HERE ──
// This is your "Source of Truth" for the store
const EXTENSION_REGISTRY = {
  hardhat: {
    id: "hardhat",
    name: "Hardhat Toolchain",
    pkg: "hardhat",
    price: "0.001",
    isPaid: true,
    icon: "🏗️"
  },
  openzeppelin: {
    id: "openzeppelin",
    name: "OpenZeppelin Contracts",
    pkg: "@openzeppelin/contracts",
    price: "0.0005",
    isPaid: true,
    icon: "🛡️"
  },
  ethers: {
    id: "ethers",
    name: "Ethers.js v6",
    pkg: "ethers",
    price: "0",
    isPaid: false,
    icon: "⬡"
  }
};

  // ── Helpers (Restored your deep-tree logic) ──
  function filesToTree(files: Record<string, string>) {
    const tree: Record<string, any> = {};
    for (const [path, contents] of Object.entries(files)) {
      const parts = path.split("/");
      let current = tree;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = { directory: {} };
        }
        current = current[parts[i]].directory;
      }
      current[parts[parts.length - 1]] = {
        file: { contents },
      };
    }
    return tree;
  }

  interface FileNode {
    name: string;
    type: "file" | "directory";
    children?: FileNode[];
  }

  function buildFileTree(files: Record<string, string>): FileNode[] {
    const root: FileNode = { name: ".", type: "directory", children: [] };
    const dirMap: Record<string, FileNode> = { ".": root };

    const ensureDir = (dirPath: string): FileNode => {
      if (dirMap[dirPath]) return dirMap[dirPath];
      const parts = dirPath.split("/");
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      const parent = ensureDir(parentPath);
      const node: FileNode = {
        name: parts[parts.length - 1],
        type: "directory",
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
      if (parts.length > 1) {
        const dirPath = parts.slice(0, -1).join("/");
        ensureDir(dirPath);
      }
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
      const parent = ensureDir(parentPath);
      parent.children = parent.children || [];
      const fileName = parts[parts.length - 1];
      if (!parent.children.find((c) => c.name === fileName && c.type === "file")) {
        parent.children.push({ name: fileName, type: "file" });
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
  // ── 1. Full State (Updated with Persistence) ──
  const [files, setFiles] = useState<Record<string, string>>({ ...STARTER_FILES });
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [activeFile, setActiveFile] = useState<string>("src/App.jsx");
  const [openFiles, setOpenFiles] = useState<string[]>(["src/App.jsx"]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  // 💡 NEW: This state pulls from LocalStorage so Hardhat stays "Bought"
  const [ownedExtensions, setOwnedExtensions] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("zicon_extensions");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [settings, setSettings] = useState<EditorSettings>({
    fontSize: 14, tabSize: 2, wordWrap: false, minimap: false, lineNumbers: true, theme: "dark", githubToken: "",
  });

  // ── 2. GitHub & Repo State ──
  const [repos, setRepos] = useState<any[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [currentRepoUrl, setCurrentRepoUrl] = useState<string | null>(null);
  const [currentRepoName, setCurrentRepoName] = useState<string>("zicon-project");

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const saved = localStorage.getItem("zicon-settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return !!parsed.githubToken;
      } catch { return false; }
    }
    return false;
  });

  // ── 3. Refs ──
const wcRef = useRef<any>(null);
const terminalRef = useRef<any>(null);
const processRef = useRef<any>(null);
const bootingRef = useRef(false);

  // ── 4. PERSISTENCE EFFECTS ──
  // Saves your owned extensions whenever the list changes
  useEffect(() => {
    localStorage.setItem("zicon_extensions", JSON.stringify(ownedExtensions));
  }, [ownedExtensions]);

  // ── 5. AUTO-SYNC (The "Hardhat Repair" Logic) ──
  // Re-installs extensions automatically when the terminal boots up
  useEffect(() => {
    const syncExtensions = async () => {
      if (wcRef.current && ownedExtensions.length > 0) {
        const terminal = terminalRef.current;
        terminal?.writeln("\r\n\x1b[1;33m[System] Restoring extension toolchains...\x1b[0m");

        for (const extId of ownedExtensions) {
          const ext = (EXTENSION_REGISTRY as any)[extId];
          if (ext) {
            terminal?.writeln(`\x1b[1;30m> Re-linking ${ext.name}...\x1b[0m`);
            // Run install in background
            const proc = await wcRef.current.spawn("npm", ["install", ext.pkg]);
            await proc.exit;
          }
        }
        terminal?.writeln("\x1b[1;32m[System] All tools are synced and active.\x1b[0m\r\n");
      }
    };

    if (wcRef.current) syncExtensions();
  }, [wcRef.current]);

// ── 6. SYNC SIDEBAR WITH FILESYSTEM ──
  // This effect runs every 3 seconds to "find" the Hardhat artifacts folder
  useEffect(() => {
    if (!isRunning || !wcRef.current) return;

    const updateTreeFromDisk = async () => {
      try {
        // 1. Read the actual root directory of the WebContainer
        const rawFiles = await wcRef.current.fs.readdir('/', { withFileTypes: true });
        
        // 2. Format them into the "FileNode" structure your Sidebar expects
        const diskTree = rawFiles.map(file => ({
          name: file.name,
          type: file.isDirectory() ? "directory" : "file",
          // If it's a directory, we give it an empty array so the sidebar can 'open' it
          children: file.isDirectory() ? [] : undefined 
        }));

        // 3. Update the state (This makes 'artifacts' appear!)
        setFileTree(diskTree);
      } catch (err) {
        console.error("FileSystem Sync Error:", err);
      }
    };

    const interval = setInterval(updateTreeFromDisk, 3000);
    return () => clearInterval(interval);
  }, [isRunning, wcRef.current]);

  // ── 6. WebContainer Boot Logic ──
  const bootWebContainer = useCallback(async () => {
    if (wcRef.current || bootingRef.current) return wcRef.current;
    bootingRef.current = true;
    try {
      const terminal = terminalRef.current;
      terminal?.writeln("\x1b[1;33m⚡ Booting WebContainer...\x1b[0m");
      const wc = await WebContainer.boot();
      wcRef.current = wc;
      await wc.mount(filesToTree(files) as any);
      
      wc.on("server-ready", (_port, url) => {
        setPreviewUrl(url);
        setIsLoading(false);
        terminal?.writeln(`\x1b[1;32m✓ Dev server ready at ${url}\x1b[0m`);
      });
      
      bootingRef.current = false;
      return wc;
    } catch (err) {
      bootingRef.current = false;
      return null;
    }
  }, [files]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsLoading(true);
    
    const wc = await bootWebContainer();
    if (!wc) {
      setIsRunning(false);
      setIsLoading(false);
      return;
    }

    try {
      const terminal = terminalRef.current;
      
      // ── STEP 1: SPAWN THE INTERACTIVE SHELL ──
      // 'jsh' is the WebContainer shell. This is what makes it feel like a real computer.
      const shellProcess = await wc.spawn("jsh", {
        terminal: { cols: 80, rows: 24 }
      });
      
      // Plugs your keyboard into the shell
      processRef.current = shellProcess;

      // Pipe the shell output to the UI
      shellProcess.output.pipeTo(new WritableStream({ 
        write(data) { terminal?.write(data); } 
      }));

      // ── STEP 2: AUTOMATE THE SETUP ──
      // Instead of running npm install as a separate process, we "type" it into the shell
      const writer = shellProcess.input.getWriter();

      // Fix the folder (Replace 'project-folder' with your actual folder name)
      await writer.write("mv project-folder/* . 2>/dev/null || true\n");

      // Run Install
      terminal?.writeln("\x1b[33m[1/2] Starting Install...\x1b[0m");
      await writer.write("npm install\n");

      // Note: We don't await exit here because the shell stays open!
      writer.releaseLock();

    } catch (err) { 
      console.error("Boot error:", err);
      setIsRunning(false); 
    } finally {
      setIsLoading(false);
    }
  }, [isRunning, bootWebContainer]);

  const handleStop = useCallback(() => {
    if (processRef.current) {
      try {
        (processRef.current as any).kill();
      } catch (e) {
        console.warn("Process already stopped");
      }
    }
    setIsRunning(false);
    setIsLoading(false);
    setPreviewUrl(null);
    processRef.current = null;
    terminalRef.current?.writeln("\r\n\x1b[1;31m■ Process stopped.\x1b[0m");
  }, []);

  // ── 8. Wallet Handlers (Secure Web3 Auth) ──
  const handleConnectWallet = async () => {
    if (!(window as any).ethereum) return toast.error("Please install MetaMask");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];

      // Request a signature to verify ownership—required for Hardhat extension security
      const signer = await provider.getSigner();
      const message = `Login to Zicon IDE\nVerification Code: ${Math.floor(Math.random() * 1000000)}`;
      await signer.signMessage(message); 
      
      setWalletAddress(address);
      toast.success("Wallet Verified & Connected!");
    } catch (err) { 
      toast.error("User rejected login or connection failed"); 
    }
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
    toast.info("Wallet disconnected");
  };

  // ── 9. GitHub Logic (Repo Management) ──
  const handleGithubClone = async (repoUrl: string) => {
    const loadingToast = toast.loading("Cloning repository...");
    try {
      const response = await fetch("http://localhost:5000/api/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          repoUrl,
          token: settings.githubToken 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFiles(data.files); // Syncs your local IDE files with the cloned repo
        setCurrentRepoUrl(repoUrl);
        setCurrentRepoName(data.repoName);
        toast.success(`Cloned ${data.repoName} successfully!`, { id: loadingToast });
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Clone failed", { id: loadingToast });
    }
  };

    const handleFetchRepos = useCallback(async () => {
      if (!settings.githubToken) {
  // Instead of an error, we "teleport" the user to GitHub
  handleGithubLogin(); 
  return;
}

      setIsFetchingRepos(true);
      try {
        const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
          headers: {
            Authorization: `token ${settings.githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (!response.ok) throw new Error("GitHub Auth Failed");

        const data = await response.json();
        setRepos(Array.isArray(data) ? data : []);
        toast.success(`Fetched ${data.length} repositories`);
      } catch (err) {
        toast.error("GitHub Connection Error. Check your Token in Settings.");
      } finally {
        setIsFetchingRepos(false);
      }
    }, [settings.githubToken]);

    // ── NEW AUTOMATIC GITHUB LOGIN ──
    const handleGithubLogin = useCallback(() => {
      // 1. If we already have a token, just refresh the list
      if (settings.githubToken) {
        toast.success("Refreshing repository list...");
        handleFetchRepos(); 
        return;
      }

      // 2. Start the automatic login
      const CLIENT_ID = "Ov23li2xmxwOUm9hqgib"; // <--- Put your ID from GitHub here
      const SCOPE = "repo,user";
      
      // This line "teleports" the user to GitHub to sign in
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPE}`;
    }, [settings.githubToken, handleFetchRepos]);

const handleInstallExtension = async (extId: string, isPaid: boolean) => {
  const ext = (EXTENSION_REGISTRY as any)[extId];
  if (!ext) return toast.error("Extension not found.");

  // ── 1. THE UNINSTALL TOGGLE ──
  // If already owned, click it again to "Reset" or "Uninstall"
  if (ownedExtensions.includes(extId)) {
    setOwnedExtensions(prev => prev.filter(id => id !== extId));
    
    // Clear it from the terminal so the user knows it's gone
    terminalRef.current?.writeln(`\r\n\x1b[1;31m[System] ${ext.name} has been uninstalled.\x1b[0m`);
    return toast.info(`${ext.name} uninstalled. Click again to reinstall.`);
  }

  // ── 2. THE WALLET GUARD ──
  // If it's a paid extension and they haven't connected, STOP them here.
  if (isPaid && !walletAddress) {
    terminalRef.current?.writeln(`\r\n\x1b[1;33m[Warning] Please connect your wallet to purchase ${ext.name}\x1b[0m`);
    return toast.error("Connect Wallet first!", {
      description: "You need a connected wallet to verify ownership of this tool."
    });
  }

  // ── 3. STARTING THE PROCESS ──
  const toastId = toast.loading(isPaid ? `Processing payment for ${ext.name}...` : `Installing ${ext.name}...`);

  try {
    // 🧪 DEV MODE: Skip real payment for testing? Change to 'false' for production.
    const skipPayment = true; 

    if (isPaid && !skipPayment) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const tx = await signer.sendTransaction({
        to: "0xA9FAABCD9372AA1FCD175c3f1a7CfA0b0f8a7916", 
        value: ethers.parseEther(ext.price), 
      });

      toast.loading("Verifying transaction...", { id: toastId });
      await tx.wait();
    }

    // ── 4. THE TERMINAL INSTALLATION ──
    if (wcRef.current) {
      terminalRef.current?.writeln(`\r\n\x1b[1;34m[Zicon] Downloading: ${ext.pkg}...\x1b[0m`);

      // Run the actual npm install
      const installProc = await wcRef.current.spawn("npm", ["install", ext.pkg]);
      
      installProc.output.pipeTo(new WritableStream({
        write(data) { terminalRef.current?.write(data); }
      }));

      const exitCode = await installProc.exit;
      if (exitCode !== 0) throw new Error("Installation process failed.");
    }

    // ── 5. SUCCESS ──
const updatedExtensions = [...ownedExtensions, extId]; // Create the new array first
setOwnedExtensions(updatedExtensions); // Update React State
localStorage.setItem("zicon-owned-extensions", JSON.stringify(updatedExtensions)); // Save to Disk
toast.success(`${ext.name} is now active!`, { id: toastId });

  } catch (err: any) {
    console.error("Install Error:", err);
    toast.error("Installation failed. Check terminal.", { id: toastId });
  }
};

    const handleGitCommit = async () => {
      if (!settings.githubToken) {
        return toast.error("Please add a GitHub Token in Settings to push code.");
      }
      if (!currentRepoUrl) {
        return toast.error("No repository linked. Clone a project first to push.");
      }

      toast.loading("Pushing to GitHub...");
      try {
        const response = await fetch('http://localhost:5000/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            files, 
            token: settings.githubToken,
            repoName: currentRepoName, 
            repoUrl: currentRepoUrl
          })
        });
        
        const data = await response.json();
        toast.dismiss();
        if (data.success) toast.success("Pushed to GitHub!");
        else toast.error("Push failed: " + data.message);
      } catch (err) {
        toast.dismiss();
        toast.error("Could not connect to backend.");
      }
    };

    const handleDownload = async () => {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => zip.file(path, content));
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `zicon-project.zip`);
      toast.success("Downloaded ZIP");
    };

    // ── Zicon Sentinel: Solidity Audit ──
    const handleAuditCode = async () => {
      if (!activeFile.endsWith('.sol')) {
        return toast.error("Please open a Solidity (.sol) file to audit.");
      }
      if (!walletAddress) {
        return toast.error("Connect wallet to use Zicon Sentinel.");
      }

      const toastId = toast.loading("Zicon Sentinel: Analyzing Smart Contract...");
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const message = `Authorize Zicon Security Scan for ${activeFile}`;
        const signature = await signer.signMessage(message);

        const res = await fetch('http://localhost:5000/api/audit-solidity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: walletAddress,
            signature,
            message,
            content: files[activeFile]
          })
        });

        const data = await res.json();
        toast.dismiss(toastId);
        
        if (data.success) {
          data.reports.forEach((msg: string) => {
            msg.includes("✅") ? toast.success(msg) : toast.error(msg, { duration: 6000 });
          });
        }
      } catch (err) {
        toast.error("Audit failed. Ensure zicon-backend is running.", { id: toastId });
      }
    };

  const handleCompile = async () => {
  // 1. Safety check: make sure they actually bought it
  if (!ownedExtensions.includes("hardhat")) {
    return toast.error("Please install the Hardhat extension first.");
  }

  // 2. Safety check: make sure the WebContainer is alive
  if (!wcRef.current) {
    return toast.error("WebContainer is not initialized yet. Click 'Run' first.");
  }

  // ── BABY STEP SYNC ──
  // Write the current editor content to the virtual disk so Hardhat sees your latest code
  if (activeFile && files[activeFile]) {
    await wcRef.current.fs.writeFile(activeFile, files[activeFile]).catch(() => {});
  }

  const toastId = toast.loading("Hardhat: Compiling smart contracts...");
  const terminal = terminalRef.current;

  try {
    terminal?.writeln("\r\n\x1b[1;33m[Hardhat] Starting compilation process...\x1b[0m");

    // 3. The "Quiet" Magic Command
    // --config: tells it to use our specific config file
    // --force: tells it to "just do it" and not ask y/n questions
    const compileProc = await wcRef.current.spawn("npx", [
      "hardhat", 
      "compile", 
      "--config", 
      "hardhat.config.cjs",
      "--force" 
    ]);

    // 4. Pipe the output to the terminal so you can see the progress
    compileProc.output.pipeTo(new WritableStream({
      write(data) {
        terminal?.write(data);
      }
    }));

    const exitCode = await compileProc.exit;

    if (exitCode === 0) {
      toast.success("Contracts compiled successfully!", { id: toastId });
      // This part tells the IDE to refresh the file list so the 'artifacts' folder shows up
      fetchFiles(); 
    } else {
      toast.error("Compilation failed. Check terminal for details.", { id: toastId });
    }
  } catch (err: any) {
    console.error("Compile Error:", err);
    toast.error("An error occurred during compilation.", { id: toastId });
  }
};

// ── 10. Initialize Carbon Engine ──
const handleInitializeCarbon = async () => {
  if (!walletAddress) {
    return toast.error("Please connect your wallet to access the Carbon Engine.");
  }

  // Optional: Ask for a project name
  const projectName = prompt("Enter a name for your Carbon project:", "my-carbon-token");
  if (!projectName) return;

  const toastId = toast.loading("Injecting Carbon Token Engine...");

  try {
    const response = await fetch('http://localhost:5000/api/initialize-carbon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        walletAddress: walletAddress,
        projectName: projectName 
      })
    });

    const data = await response.json();

    if (data.success) {
      // 1. Update the local files with your proprietary code
      setFiles(data.files);
      
      // 2. Set the UI metadata
      setCurrentRepoName(projectName);
      
      // 3. Automatically open the main contract
      const solFiles = Object.keys(data.files).filter(f => f.endsWith('.sol'));
      if (solFiles.length > 0) {
        setActiveFile(solFiles[0]);
        setOpenFiles(solFiles);
      }

      // 4. If WebContainer is booted, mount the new files there too
      if (wcRef.current) {
        await wcRef.current.mount(filesToTree(data.files) as any);
      }

      toast.success("Carbon Engine Deployed Successfully!", { id: toastId });
    } else {
      throw new Error(data.error || "Failed to initialize");
    }
  } catch (err: any) {
    toast.error(`Initialization failed: ${err.message}`, { id: toastId });
  }
};

    // ── File Handlers (Full Original) ──
    const handleFileSelect = useCallback((path: string) => {
      setActiveFile(path);
      if (!openFiles.includes(path)) setOpenFiles((prev) => [...prev, path]);
    }, [openFiles]);

    const handleCloseFile = useCallback((path: string) => {
      setOpenFiles((prev) => {
        const next = prev.filter((f) => f !== path);
        if (activeFile === path) setActiveFile(next[next.length - 1] || "");
        return next;
      });
    }, [activeFile, wcRef]);

    const handleContentChange = useCallback((content: string) => {
      setFiles((prev) => ({ ...prev, [activeFile]: content }));
      if (wcRef.current) wcRef.current.fs.writeFile(activeFile, content).catch(() => {});
    }, [activeFile, wcRef]);

    const handleCreateFile = useCallback((dir: string, name: string) => {
      const fullPath = dir === "." ? name : `${dir}/${name}`;
      setFiles((prev) => ({ ...prev, [fullPath]: "" }));
      handleFileSelect(fullPath);
      if (wcRef.current) wcRef.current.fs.writeFile(fullPath, "").catch(() => {});
      toast.success(`Created ${name}`);
    }, [handleFileSelect, wcRef]);

    const handleCreateFolder = useCallback((dirPath: string, name: string) => {
      const fullPath = dirPath === "." ? name : `${dirPath}/${name}`;
      setFiles((prev) => ({ ...prev, [`${fullPath}/.gitkeep`]: "" }));
      if (wcRef.current) wcRef.current.fs.mkdir(fullPath, { recursive: true }).catch(() => {});
      toast.success(`Created folder ${name}`);
    }, []);

    // ── 1. Helper to Refresh File Tree ──
  const fetchFiles = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/files');
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setFiles(data);
        }
      }
    } catch (e) {
      console.warn("Backend offline: using local state.");
    }
  };

// ── NEW CLOUD-ONLY DELETE ──
const handleDeleteFile = async (path: string) => {
  if (!window.confirm(`Are you sure you want to delete ${path}?`)) return;

  // 1. Update UI Immediately
  setFiles((prev) => {
    const newFiles = { ...prev };
    delete newFiles[path];
    return newFiles;
  });
  setOpenFiles((prev) => prev.filter((f) => f !== path));
  if (activeFile === path) setActiveFile("");

  // 2. Update WebContainer (The Virtual Machine)
  if (wcRef.current) {
    try {
      await wcRef.current.fs.rm(path, { recursive: true });
    } catch (err) {
      console.warn("WebContainer sync failed, but UI is updated.");
    }
  }

  // 3. Silent Backend Attempt (Optional - Won't break the UI if it fails)
  fetch("http://localhost:5000/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath: path })
  }).catch(() => console.log("Backend offline, skipping server delete."));

  toast.success("Deleted from workspace");
};

const handleRenameFile = async (oldPath: string, newPathOrName: string) => {
  let newPath = newPathOrName.includes('/') 
    ? newPathOrName 
    : [...oldPath.split('/').slice(0, -1), newPathOrName].join('/');

  if (oldPath === newPath) return;

  const content = files[oldPath];

  // 1. Update UI Immediately
  setFiles((prev) => {
    const newFiles = { ...prev };
    delete newFiles[oldPath];
    newFiles[newPath] = content;
    return newFiles;
  });
  setOpenFiles((prev) => prev.map((f) => (f === oldPath ? newPath : f)));
  if (activeFile === oldPath) setActiveFile(newPath);

  // ── NEW: WebContainer Rename ──
  if (wcRef.current) {
    try {
      // In WebContainers, it's often safer to write the new and delete the old
      await wcRef.current.fs.writeFile(newPath, content);
      await wcRef.current.fs.rm(oldPath);
    } catch (err) {
      console.error("WebContainer rename error:", err);
    }
  }

  // 2. Talk to Server
  try {
    const res = await fetch("http://localhost:5000/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath })
    });
    if (!res.ok) throw new Error();
    toast.success("File moved/renamed");
  } catch (err) {
    toast.error("Operation failed");
    fetchFiles(); 
  }
};

  // ── 4. Folder Handler ──
  const handleOpenFolder = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      const loadedFiles: Record<string, string> = {};

      const readDirectory = async (handle: any, relativePath = "") => {
        for await (const entry of handle.values()) {
          const path = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          if (entry.kind === "directory") {
            await readDirectory(entry, path);
          } else {
            const file = await entry.getFile();
            const content = await file.text();
            loadedFiles[path] = content;
          }
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
      }
      toast.dismiss();
      toast.success(`Opened: ${dirHandle.name}`);
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error("Folder access denied.");
    }
  };

  // ── 5. Effects & Persistence ──
  useEffect(() => {
    const saved = localStorage.getItem("zicon-settings");
    const savedExts = localStorage.getItem("zicon-owned-extensions");
    if (saved) setSettings(JSON.parse(saved));
    if (savedExts) setOwnedExtensions(JSON.parse(savedExts));
    fetchFiles(); // Initial load from Ziconny backend
  }, []);

  useEffect(() => {
    localStorage.setItem("zicon-owned-extensions", JSON.stringify(ownedExtensions));
  }, [ownedExtensions]);

  const handleSettingsUpdate = useCallback((newSettings: EditorSettings) => {
    setSettings(newSettings);
    localStorage.setItem("zicon-settings", JSON.stringify(newSettings));
  }, []);

  // Autosave Logic
  useEffect(() => {
    if (!activeFile || !files[activeFile]) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:5000/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: activeFile, content: files[activeFile] }),
        });
        setSaveStatus(response.ok ? "saved" : "error");
        if (response.ok) setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (e) { setSaveStatus("error"); }
    }, 1000);
    return () => clearTimeout(timer);
  }, [files[activeFile], activeFile]);

  // GitHub Auth Logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");
    if (tokenFromUrl) {
      const newSettings = { ...settings, githubToken: tokenFromUrl };
      setSettings(newSettings);
      localStorage.setItem("zicon-settings", JSON.stringify(newSettings));
      setIsAuthenticated(true);
      window.history.replaceState({}, document.title, "/");
      toast.success("GitHub Connected!");
    } else if (settings.githubToken) {
      setIsAuthenticated(true);
    }
  }, [settings]);

  const handleTerminalInput = useCallback(async (data: string) => {
  // processRef.current comes from your handleRun/bootWebContainer logic
  if (processRef.current) {
    const writer = processRef.current.input.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }
}, []);

// --- 1. THE REFRESH LOGIC (Paste this before your return) ---
  const refreshFileTree = useCallback(async () => {
    if (!wcRef.current) return;

    // 1. Create a helper to scan folders recursively
    const scanDirectory = async (path: string): Promise<any[]> => {
      const entries = await wcRef.current.fs.readdir(path, { withFileTypes: true });
      
      return Promise.all(entries.map(async (entry) => {
        const entryPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
        const isDirectory = entry.isDirectory();

        return {
          name: entry.name,
          type: isDirectory ? 'directory' : 'file',
          path: entryPath,
          // 💡 KEY: If it's a folder, go inside and find its children
          children: isDirectory ? await scanDirectory(entryPath) : undefined
        };
      }));
    };

    try {
      const fullTree = await scanDirectory('/');
      setFileTree(fullTree);
    } catch (err) {
      console.error("Deep sync error:", err);
    }
  }, [wcRef]);
  
  return (
    <div className="h-screen flex flex-col bg-[#1E1E1E] text-[#CCCCCC] overflow-hidden">
      <TopBar
  projectName={currentRepoName}
  saveStatus={saveStatus}
  isRunning={isRunning}
  isAuthenticated={isAuthenticated}
  onLogin={handleGithubLogin}
  onRun={handleRun}
  onStop={handleStop}
  onDownload={handleDownload}
  onSettingsOpen={() => setSettingsOpen(true)}
  onFork={handleInitializeCarbon}
  onCommit={handleGitCommit}
  onOpenFolder={handleOpenFolder}
  walletAddress={walletAddress}
  onConnectWallet={walletAddress ? handleDisconnectWallet : handleConnectWallet}
  onAudit={handleAuditCode}
  // 👇 CHECK THESE TWO NAMES 👇
  onCompile={handleCompile}
  isHardhatActive={ownedExtensions.includes("hardhat")}
/>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={18} minSize={12}>
         <Sidebar 
  fileTree={fileTree}
  activeFile={activeFile}
  onFileSelect={setActiveFile}
  onCreateFile={handleCreateFile}
  onCreateFolder={handleCreateFolder}
  onDeleteFile={handleDeleteFile}
  onRenameFile={handleRenameFile}
  repos={repos}
  onClone={handleGithubClone}
  // 👇 UPDATE THESE TWO LINES 👇
  onFetchRepos={handleFetchRepos}      // Changed from fetchRepos to handleFetchRepos
  onGitHubLogin={handleGithubLogin}    // This matches your handleGithubLogin function
  // 👆 ---------------------- 👆
  isFetchingRepos={isFetchingRepos}
  onInstallExtension={handleInstallExtension}
  ownedExtensions={ownedExtensions}
  extensionRegistry={EXTENSION_REGISTRY}
/>
        </ResizablePanel>

        <ResizableHandle className="w-[1px] bg-[#3E3E42] hover:bg-[#007ACC] transition-colors" />

        <ResizablePanel defaultSize={42}>
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
                <div className="h-[30px] bg-[#252526] border-b border-[#3E3E42] flex items-center px-3 text-xs font-medium">
                  Terminal
                </div>
                <div className="flex-1 overflow-hidden">
                  <TerminalPanel onTerminalReady={(t) => { terminalRef.current = t; }}
                  onData={handleTerminalInput} 
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
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