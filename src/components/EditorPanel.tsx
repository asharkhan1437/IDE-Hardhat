import { X, FileCode, FileJson, FileType, File, ShieldCheck, Lock } from "lucide-react";
import { useRef, useCallback, useEffect, useState } from "react";
import type { EditorSettings } from "./SettingsDialog";

interface EditorPanelProps {
  activeFile: string;
  content: string;
  openFiles: string[];
  settings: EditorSettings;
  onContentChange: (content: string) => void;
  onFileSelect: (filepath: string) => void;
  onCloseFile: (filepath: string) => void;
  isWalletConnected?: boolean; // New: Power-up prop
}

export default function EditorPanel({
  activeFile,
  content,
  openFiles,
  settings,
  onContentChange,
  onFileSelect,
  onCloseFile,
  isWalletConnected = false,
}: EditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Power-up: Check if file is "Special" (Extension or Smart Contract)
  const isExtensionFile = activeFile.includes("extension") || activeFile.endsWith(".sol");
  const isReadOnly = isExtensionFile && !isWalletConnected;

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (filename.includes("extension")) return <ShieldCheck className="w-3.5 h-3.5 text-[#00E5FF] animate-pulse" />;
    
    switch (ext) {
      case "sol": return <FileCode className="w-3.5 h-3.5 text-[#627EEA]" />; // Ethereum Blue
      case "html": return <FileCode className="w-3.5 h-3.5 text-[#E34C26]" />;
      case "css": return <FileType className="w-3.5 h-3.5 text-[#264DE4]" />;
      case "js":
      case "jsx": return <FileCode className="w-3.5 h-3.5 text-[#F7DF1E]" />;
      case "ts":
      case "tsx": return <FileCode className="w-3.5 h-3.5 text-[#3178C6]" />;
      case "json": return <FileJson className="w-3.5 h-3.5 text-[#4EC9B0]" />;
      default: return <File className="w-3.5 h-3.5 text-[#858585]" />;
    }
  };

  const handleScroll = useCallback(() => {
    if (textareaRef.current) setScrollTop(textareaRef.current.scrollTop);
  }, []);

  useEffect(() => {
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const spaces = " ".repeat(settings.tabSize);
      onContentChange(content.substring(0, start) + spaces + content.substring(end));
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + settings.tabSize;
        }
      }, 0);
    }
  };

  const displayName = (filepath: string) => filepath.split("/").pop() || filepath;

  return (
    <div className="flex-1 flex flex-col bg-[#1E1E1E] min-w-0">
      {/* Tabs */}
      <div className="h-[35px] bg-[#252526] border-b border-[#3E3E42] flex items-center overflow-x-auto no-scrollbar">
        {openFiles.map((file) => (
          <div
            key={file}
            className={`flex items-center gap-1.5 px-3 h-full border-r border-[#3E3E42] cursor-pointer shrink-0 transition-colors ${
              activeFile === file ? "bg-[#1E1E1E] text-white shadow-[inset_0_2px_0_#007ACC]" : "bg-[#2D2D2D] text-[#858585] hover:text-[#CCCCCC]"
            }`}
            onClick={() => onFileSelect(file)}
          >
            {getFileIcon(file)}
            <span className={`text-xs ${file.includes('extension') ? 'text-cyan-400 font-medium' : ''}`}>
                {displayName(file)}
            </span>
            <button className="hover:bg-[#333333] rounded p-0.5 ml-1 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onCloseFile(file); }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Editor Content */}
      {openFiles.length > 0 ? (
        <div className="flex-1 flex overflow-hidden relative group">
          
          {/* Power-up: Read-only Wallet Lock Overlay */}
          {isReadOnly && (
            <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[1px] flex items-center justify-center flex-col gap-3">
               <Lock className="w-8 h-8 text-yellow-500 animate-bounce" />
               <p className="text-sm font-bold text-white tracking-wide">Connect Wallet to Edit Extension Files</p>
               <button className="px-4 py-1.5 bg-blue-600 rounded-md text-xs font-bold hover:bg-blue-500 transition-all">Sign with MetaMask</button>
            </div>
          )}

          {/* Line Numbers */}
          {settings.lineNumbers && (
            <div
              ref={lineNumbersRef}
              className="bg-[#1E1E1E] text-[#858585] text-right select-none overflow-hidden border-r border-[#3E3E42] transition-opacity"
              style={{
                fontFamily: "'Fira Code', 'Monaco', monospace",
                fontSize: settings.fontSize,
                lineHeight: "1.6",
                padding: "8px 12px 0 8px",
                minWidth: content.split("\n").length > 99 ? 56 : 44,
              }}
            >
              {content.split("\n").map((_, i) => (
                <div key={i} className={activeFile ? "hover:text-white" : ""}>{i + 1}</div>
              ))}
            </div>
          )}

          {/* Code Area */}
          <textarea
            ref={textareaRef}
            value={content}
            readOnly={isReadOnly}
            onChange={(e) => onContentChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className={`flex-1 bg-[#1E1E1E] text-[#CCCCCC] border-none resize-none outline-none p-2 caret-blue-500 ${isReadOnly ? 'cursor-not-allowed' : ''}`}
            style={{
              fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
              fontSize: settings.fontSize,
              lineHeight: "1.6",
              tabSize: settings.tabSize,
              wordWrap: settings.wordWrap ? "break-word" : "normal",
              whiteSpace: settings.wordWrap ? "pre-wrap" : "pre",
            }}
            spellCheck={false}
          />

          {/* Power-up Status Bar */}
          <div className="absolute bottom-4 right-6 flex items-center gap-4 text-[10px] text-[#858585] bg-[#252526]/80 backdrop-blur-md border border-[#3E3E42] px-3 py-1.5 rounded-full shadow-2xl">
             <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isWalletConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {isWalletConnected ? 'Wallet Verified' : 'No Wallet'}
             </div>
             <div className="h-3 w-[1px] bg-[#3E3E42]" />
             <span>{content.split('\n').length} Lines</span>
             <div className="h-3 w-[1px] bg-[#3E3E42]" />
             <span className="text-blue-400 font-bold uppercase">{activeFile.split('.').pop() || 'Text'}</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#1E1E1E]">
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <div className="text-6xl font-black text-[#2D2D2D] tracking-tighter mb-2">ZICON</div>
            <p className="text-[#858585] text-sm font-medium tracking-widest uppercase">Decentralized Development Environment</p>
          </div>
        </div>
      )}
    </div>
  );
}