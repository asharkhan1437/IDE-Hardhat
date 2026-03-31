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

// ── Starter project files (Restored your full original versions) ──
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

.header p {
  color: #666;
  margin-top: 0.5rem;
}

code {
  background: #f0f0f0;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.card {
  margin-top: 2rem;
}

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
  "src/index.css": `*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}`,
};

// ── Helpers ──
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
  // ── Original State ──
  const [files, setFiles] = useState<Record<string, string>>({ ...STARTER_FILES });
  const [activeFile, setActiveFile] = useState<string>("src/App.jsx");
  const [openFiles, setOpenFiles] = useState<string[]>(["src/App.jsx"]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<EditorSettings>({
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    minimap: false,
    lineNumbers: true,
    theme: "dark",
    githubToken: "",
  });

  // ── New State for Integration ──
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // ── Refs ──
  const wcRef = useRef<WebContainer | null>(null);
  const terminalRef = useRef<XTerminal | null>(null);
  const processRef = useRef<{ kill: () => void } | null>(null);
  const bootingRef = useRef(false);

  const fileTree = buildFileTree(files);

  // ── WebContainer Logic ──
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
      const installProcess = await wc.spawn("npm", ["install"]);
      installProcess.output.pipeTo(new WritableStream({ write(data) { terminalRef.current?.write(data); } }));
      if (await installProcess.exit !== 0) return setIsRunning(false);

      const devProcess = await wc.spawn("npm", ["run", "dev"]);
      processRef.current = devProcess;
      devProcess.output.pipeTo(new WritableStream({ write(data) { terminalRef.current?.write(data); } }));
    } catch (err) {
      setIsRunning(false);
    }
  }, [isRunning, bootWebContainer]);

  const handleStop = useCallback(() => {
    processRef.current?.kill();
    setIsRunning(false);
    setIsLoading(false);
    setPreviewUrl(null);
  }, []);

  // ── File Operations ──
  const handleFileSelect = useCallback((path: string) => {
    setActiveFile(path);
    if (!openFiles.includes(path)) setOpenFiles((prev) => [...prev, path]);
  }, [openFiles]);

  const handleContentChange = useCallback((content: string) => {
    setFiles((prev) => ({ ...prev, [activeFile]: content }));
    if (wcRef.current) wcRef.current.fs.writeFile(activeFile, content).catch(() => {});
  }, [activeFile]);

  const handleCreateFile = useCallback((dir: string, name: string) => {
    const fullPath = dir === "." ? name : `${dir}/${name}`;
    setFiles((prev) => ({ ...prev, [fullPath]: "" }));
    handleFileSelect(fullPath);
    if (wcRef.current) wcRef.current.fs.writeFile(fullPath, "").catch(() => {});
    toast.success(`Created ${name}`);
  }, [handleFileSelect]);

  // ── File & Tab Management ──
  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f !== path);
      if (activeFile === path) setActiveFile(next[next.length - 1] || "");
      return next;
    });
  }, [activeFile]);

  const handleDeleteFile = useCallback((filepath: string) => {
    setFiles((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key === filepath || key.startsWith(filepath + "/")) delete next[key];
      }
      return next;
    });
    setOpenFiles((prev) => prev.filter((f) => f !== filepath && !f.startsWith(filepath + "/")));
    if (activeFile === filepath || activeFile.startsWith(filepath + "/")) setActiveFile("");
    if (wcRef.current) wcRef.current.fs.rm(filepath, { recursive: true }).catch(() => {});
    toast.success(`Deleted ${filepath}`);
  }, [activeFile]);

  const handleRenameFile = useCallback((oldPath: string, newName: string) => {
    const parts = oldPath.split("/");
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    setFiles((prev) => {
      const next = { ...prev };
      if (next[oldPath] !== undefined) {
        next[newPath] = next[oldPath];
        delete next[oldPath];
      }
      return next;
    });
    setOpenFiles((prev) => prev.map((f) => (f === oldPath ? newPath : f)));
    if (activeFile === oldPath) setActiveFile(newPath);
    toast.success(`Renamed to ${newName}`);
  }, [activeFile]);

  const handleCreateFolder = useCallback((dirPath: string, name: string) => {
    const fullPath = dirPath === "." ? name : `${dirPath}/${name}`;
    setFiles((prev) => ({ ...prev, [`${fullPath}/.gitkeep`]: "" }));
    if (wcRef.current) wcRef.current.fs.mkdir(fullPath, { recursive: true }).catch(() => {});
    toast.success(`Created folder ${name}`);
  }, []);

  // ── Integration Functions (GITHUB / WALLET / EXTENSIONS) ──
  const handleConnectWallet = async () => {
    if (!(window as any).ethereum) return toast.error("Please install MetaMask");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setWalletAddress(accounts[0]);
      toast.success("Wallet connected!");
    } catch (err) {
      toast.error("Connection failed");
    }
  };

  const handleGithubClone = async (repoUrl: string) => {
    try {
      toast.loading("Cloning from GitHub...");
      const response = await fetch('http://localhost:5000/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl })
      });
      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
        toast.dismiss();
        toast.success("Project Cloned Successfully!");
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to clone. Is your backend running?");
    }
  };

  const handleInstallExtension = async (extId: string, isPaid: boolean) => {
    if (isPaid && !walletAddress) return toast.error("Connect wallet first to pay");
    
    toast.loading("Installing extension...");
    const extFiles = { "src/extension-tool.js": "console.log('Extension Active!')" };
    setFiles(prev => ({ ...prev, ...extFiles }));
    if (wcRef.current) await wcRef.current.fs.writeFile("src/extension-tool.js", extFiles["src/extension-tool.js"]);
    toast.dismiss();
    toast.success("Extension installed!");
  };

  const handleGitCommit = async () => {
    toast.loading("Pushing to GitHub...");
    const response = await fetch('http://localhost:5000/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    toast.dismiss();
    if (response.ok) toast.success("Pushed to GitHub!");
  };

  const handleDownload = async () => {
    try {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `zicon-project.zip`);
      toast.success("Project downloaded as ZIP");
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const handleFork = () => {
    toast.info("Forking repository...", {
      description: "Creating a copy in your workspace."
    });
  };

  const handleGithubLogin = () => {
    toast.info("Connecting to GitHub...", {
      description: "Opening authorization window."
    });
    // This is where you'd put your OAuth logic later!
  };

  return (
    <div className="h-screen flex flex-col bg-[#1E1E1E] text-[#CCCCCC] overflow-hidden">
      <TopBar
  projectName="zicon-project"
  isRunning={isRunning}
  onRun={handleRun}
  onStop={handleStop}
  onDownload={handleDownload} // Make sure this function exists
  onSettingsOpen={() => setSettingsOpen(true)}
  onFork={handleFork}         // Make sure this function exists
  onGithubLogin={handleGithubLogin} // Your Step 1
  onCommit={handleGitCommit}        // Your Step 6
  walletAddress={walletAddress}     // The state we created
  onConnectWallet={handleConnectWallet} // The function we created
/>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={18} minSize={12}>
          <Sidebar
            fileTree={fileTree}
            activeFile={activeFile}
            openFiles={openFiles}
            onFileSelect={handleFileSelect}
            onCreateFile={handleCreateFile}
            onCreateFolder={() => {}}
            onDeleteFile={() => {}}
            onRenameFile={() => {}}
            onClone={handleGithubClone}
            onInstallExtension={handleInstallExtension}
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
                onCloseFile={() => {}}
              />
            </ResizablePanel>
            <ResizableHandle className="h-[1px] bg-[#3E3E42] hover:bg-[#007ACC] transition-colors" />
            <ResizablePanel defaultSize={30}>
              <div className="h-full flex flex-col">
                <div className="h-[30px] bg-[#252526] border-b border-[#3E3E42] flex items-center px-3 text-xs font-medium">Terminal</div>
                <div className="flex-1 overflow-hidden">
                  <TerminalPanel onTerminalReady={(t) => { terminalRef.current = t; }} />
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
        onSettingsChange={setSettings}
      />
    </div>
  );
}