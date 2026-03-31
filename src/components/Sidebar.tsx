import {
  FileCode,
  FileJson,
  FileType,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  Trash2,
  Pencil,
  File,
  Github,
  Puzzle,
  ShieldCheck,
  RefreshCw,
  Search,
  Download
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

// --- Types ---
interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface SidebarProps {
  fileTree: FileNode[];
  activeFile: string;
  openFiles: string[];
  onFileSelect: (filepath: string) => void;
  onCreateFile: (dirPath: string, name: string) => void;
  onCreateFolder: (dirPath: string, name: string) => void;
  onDeleteFile: (filepath: string) => void;
  onRenameFile: (oldPath: string, newName: string) => void;
  repos: { name: string; url: string }[];
  onClone: (url: string) => void;
  onFetchRepos: () => void;
  isFetchingRepos?: boolean;
  onInstallExtension: (id: string, price: string) => void;
  onGitHubLogin: () => void;
}

export default function Sidebar({
  fileTree,
  activeFile,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  repos,
  onClone,
  onFetchRepos,
  isFetchingRepos,
  onInstallExtension,
}: SidebarProps) {
  // --- States ---
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set([".", "src"]));
  const [creatingIn, setCreatingIn] = useState<{ dir: string; type: "file" | "folder" } | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [customCloneUrl, setCustomCloneUrl] = useState(""); // <--- NEW STATE
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when creating/renaming
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [creatingIn, renamingFile]);

  // --- Handlers ---
  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleCustomClone = () => {
    if (!customCloneUrl.trim()) return;
    onClone(customCloneUrl.trim());
    setCustomCloneUrl("");
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "html": return <FileCode className="w-4 h-4 text-[#E34C26] shrink-0" />;
      case "css": return <FileType className="w-4 h-4 text-[#264DE4] shrink-0" />;
      case "js":
      case "jsx": return <FileCode className="w-4 h-4 text-[#F7DF1E] shrink-0" />;
      case "ts":
      case "tsx": return <FileCode className="w-4 h-4 text-[#3178C6] shrink-0" />;
      case "sol": return <ShieldCheck className="w-4 h-4 text-[#4EC9B0] shrink-0" />;
      case "json": return <FileJson className="w-4 h-4 text-[#4EC9B0] shrink-0" />;
      case "md": return <File className="w-4 h-4 text-[#519ABA] shrink-0" />;
      case "svg": return <File className="w-4 h-4 text-[#FFB13B] shrink-0" />;
      default: return <FileCode className="w-4 h-4 text-[#858585] shrink-0" />;
    }
  };

  const handleInputSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      if (creatingIn) {
        creatingIn.type === "file" 
          ? onCreateFile(creatingIn.dir, inputValue.trim())
          : onCreateFolder(creatingIn.dir, inputValue.trim());
        setCreatingIn(null);
      } else if (renamingFile) {
        onRenameFile(renamingFile, inputValue.trim());
        setRenamingFile(null);
      }
      setInputValue("");
    } else if (e.key === "Escape") {
      setCreatingIn(null);
      setRenamingFile(null);
      setInputValue("");
    }
  };

  // --- Recursive Render Logic ---
  const renderNode = (node: FileNode, parentPath: string, depth: number) => {
    const fullPath = parentPath === "." ? node.name : `${parentPath}/${node.name}`;
    const isExpanded = expandedDirs.has(fullPath);
    const isActive = activeFile === fullPath;
    const paddingLeft = depth * 12 + 12;

    if (node.type === "directory") {
      return (
        <div key={fullPath}>
          <ContextMenu>
            <ContextMenuTrigger>
              <div
                className="flex items-center gap-1 py-1 hover:bg-[#2A2D2E] cursor-pointer text-sm"
                style={{ paddingLeft }}
                onClick={() => toggleDir(fullPath)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-[#858585] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#858585] shrink-0" />}
                {isExpanded ? <FolderOpen className="w-4 h-4 text-[#DCAA5F] shrink-0" /> : <Folder className="w-4 h-4 text-[#DCAA5F] shrink-0" />}
                <span className="text-[#CCCCCC] truncate ml-1">{node.name}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="bg-[#252526] border-[#3E3E42]">
              <ContextMenuItem className="text-[#CCCCCC] focus:bg-[#094771]" onClick={() => { setCreatingIn({ dir: fullPath, type: "file" }); if (!isExpanded) toggleDir(fullPath); }}>
                <Plus className="w-4 h-4 mr-2" /> New File
              </ContextMenuItem>
              <ContextMenuItem className="text-[#CCCCCC] focus:bg-[#094771]" onClick={() => { setCreatingIn({ dir: fullPath, type: "folder" }); if (!isExpanded) toggleDir(fullPath); }}>
                <FolderPlus className="w-4 h-4 mr-2" /> New Folder
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-[#3E3E42]" />
              <ContextMenuItem className="text-[#F44747] focus:bg-[#902727]" onClick={() => onDeleteFile(fullPath)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          
          {isExpanded && (
            <div>
              {creatingIn?.dir === fullPath && (
                <div className="flex items-center gap-1 py-1" style={{ paddingLeft: paddingLeft + 20 }}>
                  {creatingIn.type === "file" ? <File className="w-4 h-4 text-[#858585]" /> : <Folder className="w-4 h-4 text-[#DCAA5F]" />}
                  <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleInputSubmit}
                    onBlur={() => setCreatingIn(null)}
                    className="bg-[#1E1E1E] border border-[#007ACC] text-[#CCCCCC] text-sm px-1 outline-none rounded w-full mr-2"
                  />
                </div>
              )}
              {node.children?.map((child) => renderNode(child, fullPath, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <ContextMenu key={fullPath}>
        <ContextMenuTrigger>
          <div
            className={`flex items-center gap-2 py-1 hover:bg-[#2A2D2E] cursor-pointer text-sm ${isActive ? "bg-[#37373D] border-l-2 border-[#007ACC]" : ""}`}
            style={{ paddingLeft: paddingLeft + 16 }}
            onClick={() => onFileSelect(fullPath)}
          >
            {renamingFile === fullPath ? (
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputSubmit}
                onBlur={() => setRenamingFile(null)}
                className="bg-[#1E1E1E] border border-[#007ACC] text-[#CCCCCC] text-sm px-1 outline-none rounded w-full mr-2"
              />
            ) : (
              <>
                {getFileIcon(node.name)}
                <span className={`truncate ${isActive ? "text-white" : "text-[#CCCCCC]"}`}>{node.name}</span>
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-[#252526] border-[#3E3E42]">
          <ContextMenuItem className="text-[#CCCCCC] focus:bg-[#094771]" onClick={() => { setRenamingFile(fullPath); setInputValue(node.name); }}>
            <Pencil className="w-4 h-4 mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuItem className="text-[#F44747] focus:bg-[#902727]" onClick={() => onDeleteFile(fullPath)}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="h-full bg-[#252526] border-r border-[#3E3E42] flex flex-col select-none overflow-hidden w-64">
      
      {/* SECTION 1: GITHUB REPOS */}
      <div className="border-b border-[#3E3E42] bg-[#252526]">
        <div className="p-3 flex items-center justify-between text-[10px] font-bold text-[#858585] uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Github className="w-3.5 h-3.5" />
            GitHub Repos
          </div>
          <button 
            onClick={onFetchRepos}
            className={`hover:text-white transition-colors ${isFetchingRepos ? 'animate-spin' : ''}`}
            title="Sync Repos"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* CUSTOM CLONE INPUT <--- NEW ADDITION */}
        <div className="px-3 pb-2 flex gap-1">
          <input 
             type="text"
             value={customCloneUrl}
             onChange={(e) => setCustomCloneUrl(e.target.value)}
             placeholder="Paste Repo URL..."
             className="flex-1 bg-[#1e1e1e] border border-[#3E3E42] rounded text-[10px] p-1.5 text-gray-300 outline-none focus:border-[#007ACC]"
             onKeyDown={(e) => e.key === "Enter" && handleCustomClone()}
          />
          <button 
             onClick={handleCustomClone}
             className="bg-[#333333] hover:bg-[#007ACC] p-1.5 rounded transition-colors group"
             title="Clone Repo"
          >
            <Download className="w-3 h-3 text-[#858585] group-hover:text-white" />
          </button>
        </div>

        <div className="px-2 pb-3 space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar">
          {repos.length === 0 ? (
            <p className="text-[10px] text-gray-600 px-2 italic font-normal">Connect GitHub in Settings</p>
          ) : (
            repos.map((repo) => (
              <div key={repo.name} className="flex items-center justify-between p-2 bg-[#1e1e1e] hover:bg-[#2a2d2e] rounded border border-[#3E3E42] group transition-all">
                <span className="text-[11px] text-[#CCCCCC] truncate max-w-[120px]">{repo.name}</span>
                <button 
                  onClick={() => onClone(repo.url)}
                  className="text-[9px] bg-[#007ACC] hover:bg-[#005a9e] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Clone
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: EXPLORER HEADER */}
      <div className="p-3 border-b border-[#3E3E42] flex items-center justify-between bg-[#252526]">
        <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setCreatingIn({ dir: ".", type: "file" })} className="hover:bg-[#333333] rounded p-1" title="New File">
            <Plus className="w-3.5 h-3.5 text-[#858585]" />
          </button>
          <button onClick={() => setCreatingIn({ dir: ".", type: "folder" })} className="hover:bg-[#333333] rounded p-1" title="New Folder">
            <FolderPlus className="w-3.5 h-3.5 text-[#858585]" />
          </button>
        </div>
      </div>

      {/* SECTION 3: FILE TREE */}
      <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
        {fileTree.map((node) => renderNode(node, ".", 0))}
      </div>

      {/* SECTION 4: MARKETPLACE */}
      <div className="mt-auto border-t border-[#3E3E42] bg-[#1e1e1e] p-3">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-bold text-[#858585] uppercase tracking-wider">
          <Puzzle className="w-3.5 h-3.5 text-[#007ACC]" />
          Marketplace
        </div>
        
        <div className="p-2 rounded bg-[#252526] border border-[#3E3E42] hover:border-[#007ACC] transition-colors group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-white font-medium flex items-center gap-1">
              Web3 Auth <ShieldCheck className="w-3 h-3 text-[#4EC9B0]" />
            </span>
            <span className="text-[10px] text-[#4EC9B0] font-mono">0.01 ETH</span>
          </div>
          <button 
            className="w-full h-6 text-[10px] bg-[#333333] hover:bg-[#007ACC] text-[#CCCCCC] hover:text-white rounded transition-colors mt-1 border border-[#3E3E42]"
            onClick={() => onInstallExtension("web3-auth", "0.01")}
          >
            Buy & Install
          </button>
        </div>
      </div>
    </div>
  );
}