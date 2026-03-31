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
  LayoutGrid,
  Files,
  Download,
  ShieldCheck,
  RefreshCw,
  Search,
  Package,
  XCircle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface SidebarProps {
  fileTree: any[];
  activeFile: string;
  onFileSelect: (path: string) => void;
  onCreateFile: (dir: string, name: string) => void;
  onCreateFolder: (dir: string, name: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newName: string) => void;
  repos: any[];
  onClone: (url: string) => void;
  onFetchRepos: () => void;
  isFetchingRepos: boolean;
  onInstallExtension: (id: string, isPaid: boolean) => void;
  ownedExtensions: string[];
  onGitHubLogin: () => void;
  extensionRegistry: any;
}

type Tab = "explorer" | "github" | "marketplace";

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
  ownedExtensions,
  onGitHubLogin,
  extensionRegistry,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("explorer");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["", "src"]));
  const [creatingIn, setCreatingIn] = useState<{ dir: string; type: "file" | "folder" } | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredRepos = repos.filter((r) =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

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
    if (!customUrl.trim()) return;
    onClone(customUrl.trim());
    setCustomUrl("");
  };

  const onDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.setData("oldPath", path);
  };

  const onDrop = (e: React.DragEvent, targetDirPath: string) => {
    e.preventDefault();
    setDragOverPath(null);
    const oldPath = e.dataTransfer.getData("oldPath");
    const fileName = oldPath.split("/").pop();

    if (oldPath && fileName) {
      const newPath = targetDirPath === "" ? fileName : `${targetDirPath}/${fileName}`;
      if (oldPath !== newPath) onRenameFile(oldPath, newPath);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "sol": return <ShieldCheck className="w-4 h-4 text-[#AA6746] shrink-0" />;
      case "html": return <FileCode className="w-4 h-4 text-[#E34C26] shrink-0" />;
      case "css": return <FileType className="w-4 h-4 text-[#264DE4] shrink-0" />;
      case "js":
      case "jsx": return <FileCode className="w-4 h-4 text-[#F7DF1E] shrink-0" />;
      case "ts":
      case "tsx": return <FileCode className="w-4 h-4 text-[#3178C6] shrink-0" />;
      case "json": return <FileJson className="w-4 h-4 text-[#4EC9B0] shrink-0" />;
      case "md": return <File className="w-4 h-4 text-[#519ABA] shrink-0" />;
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
    const fullPath = parentPath === "" ? node.name : `${parentPath}/${node.name}`;
    const isExpanded = expandedDirs.has(fullPath);
    const isActive = activeFile === fullPath;
    const paddingLeft = depth * 12 + 8;

    if (node.type === "directory") {
      return (
        <div key={fullPath}>
          <ContextMenu>
            <ContextMenuTrigger>
              <div
                className={`flex items-center gap-1 py-1 hover:bg-[#2A2D2E] cursor-pointer text-sm transition-all ${
                  dragOverPath === fullPath ? "bg-[#094771] ring-1 ring-[#007ACC]" : ""
                }`}
                style={{ paddingLeft }}
                onClick={() => toggleDir(fullPath)}
                onDragOver={(e) => { e.preventDefault(); setDragOverPath(fullPath); }}
                onDragLeave={() => setDragOverPath(null)}
                onDrop={(e) => onDrop(e, fullPath)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-[#858585]" /> : <ChevronRight className="w-4 h-4 text-[#858585]" />}
                {isExpanded ? <FolderOpen className="w-4 h-4 text-[#DCAA5F]" /> : <Folder className="w-4 h-4 text-[#DCAA5F]" />}
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
              <ContextMenuItem className="text-[#F44747] focus:bg-[#094771]" onClick={() => onDeleteFile(fullPath)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          {isExpanded && (
            <div>
              {creatingIn?.dir === fullPath && (
                <div className="flex items-center gap-1 py-1" style={{ paddingLeft: paddingLeft + 20 }}>
                  {creatingIn.type === "file" ? <File className="w-4 h-4 text-[#858585]" /> : <Folder className="w-4 h-4 text-[#DCAA5F]" />}
                  <input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleInputSubmit} onBlur={() => setCreatingIn(null)} className="bg-[#1E1E1E] border border-[#007ACC] text-[#CCCCCC] text-sm px-1 outline-none rounded w-full max-w-[140px]" />
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
            draggable
            onDragStart={(e) => onDragStart(e, fullPath)}
            className={`flex items-center gap-2 py-1 hover:bg-[#2A2D2E] cursor-pointer text-sm ${isActive ? "bg-[#37373D] border-l-2 border-[#007ACC]" : ""}`}
            style={{ paddingLeft: paddingLeft + 20 }}
            onClick={() => onFileSelect(fullPath)}
          >
            {renamingFile === fullPath ? (
              <input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleInputSubmit} onBlur={() => setRenamingFile(null)} className="bg-[#1E1E1E] border border-[#007ACC] text-[#CCCCCC] text-sm px-1 outline-none rounded w-full" />
            ) : (
              <>
                {getFileIcon(node.name)}
                <span className={`truncate ${isActive ? "text-white" : "text-[#CCCCCC]"}`}>{node.name}</span>
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-[#252526] border-[#3E3E42]">
          <ContextMenuItem className="text-[#CCCCCC]" onClick={() => { setRenamingFile(fullPath); setInputValue(node.name); }}>
            <Pencil className="w-4 h-4 mr-2" /> Rename
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-[#3E3E42]" />
          <ContextMenuItem className="text-[#F44747]" onClick={() => onDeleteFile(fullPath)}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="h-full bg-[#1E1E1E] border-r border-[#3E3E42] flex select-none">
      <div className="w-12 bg-[#333333] flex flex-col items-center py-4 gap-4 border-r border-[#1E1E1E]">
        <button onClick={() => setActiveTab("explorer")} className={`p-2 rounded ${activeTab === "explorer" ? "text-white bg-[#444]" : "text-[#858585] hover:text-white"}`} title="Explorer">
          <Files className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab("github")} className={`p-2 rounded ${activeTab === "github" ? "text-white bg-[#444]" : "text-[#858585] hover:text-white"}`} title="GitHub Sync">
          <Github className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab("marketplace")} className={`p-2 rounded ${activeTab === "marketplace" ? "text-white bg-[#444]" : "text-[#858585] hover:text-white"}`} title="Marketplace">
          <LayoutGrid className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col bg-[#252526] overflow-hidden w-64">
        {activeTab === "explorer" && (
          <>
            <div className="p-3 border-b border-[#3E3E42] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">Explorer</span>
              <div className="flex gap-1">
                <button onClick={() => setCreatingIn({ dir: "", type: "file" })} className="p-1 hover:bg-[#333333] rounded" title="New File"><Plus className="w-3.5 h-3.5 text-[#858585]" /></button>
                <button onClick={() => setCreatingIn({ dir: "", type: "folder" })} className="p-1 hover:bg-[#333333] rounded" title="New Folder"><FolderPlus className="w-3.5 h-3.5 text-[#858585]" /></button>
              </div>
            </div>
            <div
              className={`flex-1 overflow-y-auto py-1 transition-colors ${dragOverPath === "" ? "bg-[#094771]/20" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverPath(""); }}
              onDragLeave={() => setDragOverPath(null)}
              onDrop={(e) => onDrop(e, "")}
            >
              {creatingIn?.dir === "" && (
                <div className="flex items-center gap-1 py-1 px-4">
                  {creatingIn.type === "file" ? <File className="w-4 h-4 text-[#858585]" /> : <Folder className="w-4 h-4 text-[#DCAA5F]" />}
                  <input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleInputSubmit} onBlur={() => setCreatingIn(null)} className="bg-[#1E1E1E] border border-[#007ACC] text-[#CCCCCC] text-sm px-1 outline-none rounded w-full" />
                </div>
              )}
              {fileTree.map((node) => renderNode(node, "", 0))}
            </div>
          </>
        )}

        {activeTab === "github" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-[#3E3E42] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">GitHub Browser</span>
              <button onClick={onFetchRepos} className={`p-1 hover:bg-[#333333] rounded transition-transform ${isFetchingRepos ? "animate-spin" : ""}`} title="Refresh Repositories">
                <RefreshCw className="w-3.5 h-3.5 text-[#858585]" />
              </button>
            </div>
            <div className="p-3 bg-black/20 border-b border-[#3E3E42]">
              <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block tracking-tight">Clone Public URL</label>
              <div className="flex gap-1">
                <input className="flex-1 bg-[#1E1E1E] border border-[#3E3E42] py-1.5 px-2 text-xs text-[#CCCCCC] rounded outline-none focus:border-[#007ACC]" placeholder="https://github.com/..." value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCustomClone()} />
                <button onClick={handleCustomClone} className="bg-[#007ACC] hover:bg-[#005a9e] px-2 rounded transition-colors"><Download className="w-3.5 h-3.5 text-white" /></button>
              </div>
            </div>
            <div className="p-2">
              <label className="text-[10px] text-gray-500 font-bold uppercase mb-2 block tracking-tight px-1">Search Your Repos</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
                <input className="w-full bg-[#1E1E1E] border border-[#3E3E42] py-1.5 pl-8 pr-2 text-xs text-[#CCCCCC] rounded outline-none focus:border-[#007ACC]" placeholder="Filter my repos..." value={repoSearch} onChange={(e) => setRepoSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
              {filteredRepos.map((repo) => (
                <div key={repo.id} className="p-2 rounded bg-[#1E1E1E] border border-[#3E3E42] hover:border-[#007ACC] group transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <Github className="w-3 h-3 text-[#007ACC]" />
                    <span className="text-xs font-medium text-[#CCCCCC] truncate">{repo.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 line-clamp-2 mb-2 leading-relaxed font-normal">{repo.description || "No description provided."}</p>
                  <button onClick={() => onClone(repo.clone_url)} className="w-full h-7 bg-[#333333] hover:bg-[#007ACC] text-white text-[10px] rounded flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-3 h-3" /> Clone
                  </button>
                </div>
              ))}
              {repos.length === 0 && !isFetchingRepos && (
                <div className="text-center py-10 px-4">
                  <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest font-bold">No Repos Found</p>
                  <button onClick={onGitHubLogin} className="text-[#007ACC] hover:underline text-xs">Sync with GitHub</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "marketplace" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-[#3E3E42] flex justify-between items-center">
              <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">Zicon Marketplace</span>
              <span className="text-[10px] bg-[#333] px-2 py-0.5 rounded text-[#858585]">
                {ownedExtensions.length} Active
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {Object.values(extensionRegistry).map((ext: any) => {
                const isOwned = ownedExtensions.includes(ext.id);

                return (
                  <div
                    key={ext.id}
                    className={`p-3 border rounded transition-all relative overflow-hidden group ${
                      isOwned
                        ? "bg-[#1e2a24] border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.05)]"
                        : "bg-[#1E1E1E] border-[#3E3E42] hover:border-[#007ACC]"
                    }`}
                  >
                    {isOwned && (
                      <div className="absolute top-0 right-0 bg-green-500 text-[8px] text-white px-2 py-0.5 font-bold uppercase tracking-tighter rounded-bl">
                        Installed
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{ext.icon}</span>
                      <span className={`text-sm font-medium ${isOwned ? "text-green-400" : "text-white"}`}>
                        {ext.name}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#858585] mb-3 leading-relaxed">
                      Toolchain: <code className="text-[#4EC9B0] bg-black/30 px-1 rounded">{ext.pkg}</code>
                    </p>

                    <button
                      onClick={() => onInstallExtension(ext.id, ext.isPaid)}
                      className={`w-full py-1.5 rounded text-[11px] font-medium transition-all flex items-center justify-center gap-2 border ${
                        isOwned
                          ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white hover:border-red-600"
                          : "bg-[#007ACC] hover:bg-[#005a9e] text-white border-transparent"
                      }`}
                    >
                      {isOwned ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Remove Extension
                        </>
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5" />
                          {ext.isPaid ? `Unlock with ETH (${ext.price})` : "Install Extension"}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}