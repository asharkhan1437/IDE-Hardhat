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
  Download,
  CheckCircle2,
  Lock,
  Store,
  Bot,
  Users,
  GitFork,
  ExternalLink,
  Globe,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { EXTENSIONS } from "@/data/extensions";

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
  onRefreshFiles?: () => void;
  onCreateFolder: (dirPath: string, name: string) => void;
  onDeleteFile: (filepath: string) => void;
  onRenameFile: (oldPath: string, newName: string) => void;
  repos: {
    name: string;
    cloneUrl: string;
    fullName?: string;
    htmlUrl?: string;
    private?: boolean;
    fork?: boolean;
    owner?: string;
  }[];
  onClone: (url: string) => void;
  onFetchRepos: () => void;
  onForkRepo: (fullName: string) => void;
  onCreateRepo: () => void;
  isFetchingRepos?: boolean;
  onInstallExtension: (id: string, price: string) => void;
  onOpenMarketplace: () => void;
  onOpenAIChat: () => void;
  onOpenCollab?: () => void;
  onGitHubLogin: () => void;
  walletAddress: string | null;
  checkOwnership: (id: string) => boolean;
}

export default function Sidebar({
  fileTree,
  activeFile,
  onFileSelect,
  onCreateFile,
  onRefreshFiles,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  repos,
  onClone,
  onFetchRepos,
  onForkRepo,
  onCreateRepo,
  onGitHubLogin,
  isFetchingRepos,
  onInstallExtension,
  onOpenMarketplace,
  onOpenAIChat,
  onOpenCollab,
  walletAddress,
  checkOwnership,
}: SidebarProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set([".", "src"]));
  const [githubExpanded, setGithubExpanded] = useState(() => localStorage.getItem("zicon-sidebar-github") === "1");
  const [extensionsExpanded, setExtensionsExpanded] = useState(() => localStorage.getItem("zicon-sidebar-extensions") === "1");

  const toggleGithub = () => {
    setGithubExpanded((v) => {
      localStorage.setItem("zicon-sidebar-github", v ? "0" : "1");
      return !v;
    });
  };
  const toggleExtensions = () => {
    setExtensionsExpanded((v) => {
      localStorage.setItem("zicon-sidebar-extensions", v ? "0" : "1");
      return !v;
    });
  };
  const [creatingIn, setCreatingIn] = useState<{ dir: string; type: "file" | "folder" } | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [customCloneUrl, setCustomCloneUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [creatingIn, renamingFile]);

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
      case "yml":
      case "yaml": return <FileCode className="w-4 h-4 text-[#CB171E] shrink-0" />;
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
                <div className="flex items-center gap-1.5 py-1 mx-1 mb-0.5 px-2 bg-[#094771] border border-[#007ACC] rounded" style={{ marginLeft: paddingLeft }}>
                  {creatingIn.type === "file" ? <File className="w-3.5 h-3.5 text-[#858585] shrink-0" /> : <Folder className="w-3.5 h-3.5 text-[#DCAA5F] shrink-0" />}
                  <input
                    ref={inputRef}
                    autoFocus
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && inputValue.trim()) {
                        creatingIn.type === "file"
                          ? onCreateFile(fullPath, inputValue.trim())
                          : onCreateFolder(fullPath, inputValue.trim());
                        setCreatingIn(null);
                        setInputValue("");
                      } else if (e.key === "Escape") {
                        setCreatingIn(null);
                        setInputValue("");
                      }
                    }}
                    placeholder={creatingIn.type === "file" ? "filename.tsx" : "folder-name"}
                    className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-[#4a7da8]"
                  />
                  <button onMouseDown={(e) => { e.preventDefault(); if (inputValue.trim()) { creatingIn.type === "file" ? onCreateFile(fullPath, inputValue.trim()) : onCreateFolder(fullPath, inputValue.trim()); } setCreatingIn(null); setInputValue(""); }} className="text-[9px] text-green-400 hover:text-white px-1">✓</button>
                  <button onMouseDown={(e) => { e.preventDefault(); setCreatingIn(null); setInputValue(""); }} className="text-[9px] text-[#555] hover:text-white px-1">✕</button>
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

  // Show first 4 extensions in sidebar preview
  const previewExtensions = EXTENSIONS.slice(0, 4);

  return (
    <div className="h-full bg-[#252526] border-r border-[#3E3E42] flex flex-col select-none overflow-hidden w-64">

      {/* SECTION 1: GITHUB REPOS (collapsible) */}
      <div className="border-b border-[#3E3E42] bg-[#252526] shrink-0">
        <div
          onClick={toggleGithub}
          className="p-3 flex items-center justify-between text-[10px] font-bold text-[#858585] uppercase tracking-wider hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {githubExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Github className="w-3.5 h-3.5" />
            GitHub Repos
            {repos.length > 0 && (
              <span className="text-[9px] text-[#858585] bg-[#1e1e1e] px-1.5 py-0.5 rounded-full normal-case font-mono">
                {repos.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onCreateRepo(); }}
              className="hover:text-white transition-colors"
              title="Create new repo"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onFetchRepos(); }}
              className={`hover:text-white transition-colors ${isFetchingRepos ? 'animate-spin' : ''}`}
              title="Sync Repos"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {githubExpanded && (
        <>
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

        <div className="px-2 pb-3 space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
          {repos.length === 0 ? (
            <button
              onClick={onGitHubLogin}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-[#007ACC] hover:text-white hover:bg-[#2A2D2E] rounded transition-colors text-left"
            >
              <Github className="w-3 h-3 shrink-0" />
              <span>Connect GitHub <span className="text-[#555]">(or paste a PAT in Settings)</span></span>
            </button>
          ) : (
            repos.map((repo) => (
              <div key={repo.fullName || repo.name} className="flex items-center justify-between p-2 bg-[#1e1e1e] hover:bg-[#2a2d2e] rounded border border-[#3E3E42] group transition-all">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {repo.private ? (
                    <Lock className="w-2.5 h-2.5 text-[#858585] shrink-0" title="Private" />
                  ) : (
                    <Globe className="w-2.5 h-2.5 text-[#555] shrink-0" title="Public" />
                  )}
                  <span className="text-[11px] text-[#CCCCCC] truncate">{repo.name}</span>
                  {repo.fork && (
                    <GitFork className="w-2.5 h-2.5 text-[#858585] shrink-0" title="Fork" />
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {repo.htmlUrl && (
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-[#858585] hover:text-white"
                      title="Open on GitHub"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {repo.fullName && (
                    <button
                      onClick={() => onForkRepo(repo.fullName!)}
                      className="p-1 text-[#858585] hover:text-purple-400"
                      title="Fork to your account"
                    >
                      <GitFork className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => onClone(repo.cloneUrl)}
                    className="text-[9px] bg-[#007ACC] hover:bg-[#005a9e] text-white px-2 py-0.5 rounded"
                  >
                    Clone
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        </>
        )}
      </div>

      {/* SECTION 2: EXPLORER HEADER */}
      <div className="p-3 border-b border-[#3E3E42] flex items-center justify-between bg-[#252526] shrink-0">
        <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setCreatingIn({ dir: ".", type: "file" })} className="hover:bg-[#333333] rounded p-1" title="New File">
            <Plus className="w-3.5 h-3.5 text-[#858585]" />
          </button>
          <button onClick={() => setCreatingIn({ dir: ".", type: "folder" })} className="hover:bg-[#333333] rounded p-1" title="New Folder">
            <FolderPlus className="w-3.5 h-3.5 text-[#858585]" />
          </button>
          {onRefreshFiles && (
            <button onClick={onRefreshFiles} className="hover:bg-[#333333] rounded p-1" title="Refresh file tree from disk">
              <RefreshCw className="w-3.5 h-3.5 text-[#858585]" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: FILE TREE */}
      <div className="flex-1 overflow-y-auto py-1 custom-scrollbar min-h-0">
        {/* Root-level new file/folder input */}
        {creatingIn?.dir === "." && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 mx-1 mb-1 bg-[#094771] border border-[#007ACC] rounded">
            {creatingIn.type === "file"
              ? <File className="w-3.5 h-3.5 text-[#858585] shrink-0" />
              : <Folder className="w-3.5 h-3.5 text-[#DCAA5F] shrink-0" />}
            <input
              ref={inputRef}
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) {
                  creatingIn.type === "file"
                    ? onCreateFile(".", inputValue.trim())
                    : onCreateFolder(".", inputValue.trim());
                  setCreatingIn(null);
                  setInputValue("");
                } else if (e.key === "Escape") {
                  setCreatingIn(null);
                  setInputValue("");
                }
              }}
              placeholder={creatingIn.type === "file" ? "filename.tsx" : "folder-name"}
              className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-[#4a7da8]"
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (inputValue.trim()) {
                    creatingIn.type === "file"
                      ? onCreateFile(".", inputValue.trim())
                      : onCreateFolder(".", inputValue.trim());
                  }
                  setCreatingIn(null);
                  setInputValue("");
                }}
                className="text-[9px] text-green-400 hover:text-white px-1"
              >✓</button>
              <button
                onMouseDown={(e) => { e.preventDefault(); setCreatingIn(null); setInputValue(""); }}
                className="text-[9px] text-[#555] hover:text-white px-1"
              >✕</button>
            </div>
          </div>
        )}
        {fileTree.map((node) => renderNode(node, ".", 0))}
      </div>

      {/* SECTION 3.5: AI ASSISTANT + COLLAB */}
      <div className="border-t border-[#3E3E42] bg-[#1e1e1e] px-2 py-2 shrink-0 space-y-1">
        <button
          onClick={onOpenAIChat}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-[#252526] border border-[#3E3E42] hover:border-[#D97757] transition-colors group"
        >
          <Bot className="w-3.5 h-3.5 text-[#D97757]" />
          <span className="text-[11px] text-[#CCCCCC] group-hover:text-white">AI Assistant</span>
          <span className="ml-auto text-[9px] text-[#555]">Claude</span>
        </button>
        {onOpenCollab && (
          <button
            onClick={onOpenCollab}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded bg-[#252526] border border-[#3E3E42] hover:border-[#007ACC] transition-colors group"
          >
            <Users className="w-3.5 h-3.5 text-[#007ACC]" />
            <span className="text-[11px] text-[#CCCCCC] group-hover:text-white">Team Session</span>
            <span className="ml-auto text-[9px] text-[#555]">MetaMask</span>
          </button>
        )}
      </div>

      {/* SECTION 4: MARKETPLACE PREVIEW (collapsible) */}
      <div className="mt-auto border-t border-[#3E3E42] bg-[#1e1e1e] shrink-0">
        {/* Header */}
        <div
          onClick={toggleExtensions}
          className="flex items-center justify-between px-3 pt-3 pb-2 cursor-pointer hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#858585] uppercase tracking-wider">
            {extensionsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Puzzle className="w-3.5 h-3.5 text-[#007ACC]" />
            Extensions
            <span className="text-[9px] text-[#858585] bg-[#252526] px-1.5 py-0.5 rounded-full normal-case font-mono">
              {EXTENSIONS.length}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenMarketplace(); }}
            className="flex items-center gap-1 text-[9px] text-[#007ACC] hover:text-white transition-colors"
          >
            <Store className="w-3 h-3" />
            Browse All
          </button>
        </div>

        {/* Preview cards */}
        {extensionsExpanded && (
        <div className="px-2 pb-3 space-y-1">
          {previewExtensions.map((ext) => {
            const owned = checkOwnership(ext.id);
            return (
              <div
                key={ext.id}
                className="flex items-center justify-between p-2 rounded bg-[#252526] border border-[#3E3E42] hover:border-[#555] transition-colors group cursor-pointer"
                onClick={onOpenMarketplace}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm leading-none shrink-0">{ext.icon}</span>
                  <span className="text-[11px] text-[#CCCCCC] truncate">{ext.name}</span>
                </div>
                {owned ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                ) : walletAddress ? (
                  <span className="text-[9px] text-[#4EC9B0] font-mono shrink-0">{ext.price}Ξ</span>
                ) : (
                  <Lock className="w-3 h-3 text-[#555] shrink-0" />
                )}
              </div>
            );
          })}

          <button
            onClick={onOpenMarketplace}
            className="w-full text-[10px] text-[#555] hover:text-[#007ACC] transition-colors pt-1 flex items-center justify-center gap-1"
          >
            +{EXTENSIONS.length - 4} more extensions
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
