import { X, FileCode, FileJson, FileType, File, ShieldCheck, ShieldAlert, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
  isWalletConnected: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error"; // Added this line
}

export default function EditorPanel({
  activeFile,
  content,
  openFiles,
  settings,
  onContentChange,
  onFileSelect,
  onCloseFile,
  isWalletConnected,
  saveStatus, // Destructured here
}: EditorPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const lines = content.split("\n");
  const lineCount = lines.length;

  const getFileIcon = (filename: string) => {
    const name = filename.split("/").pop() || filename;
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
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

  const getLanguage = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "html": return "HTML";
      case "css": return "CSS";
      case "js": return "JavaScript";
      case "jsx": return "JSX";
      case "ts": return "TypeScript";
      case "tsx": return "TSX";
      case "json": return "JSON";
      case "md": return "Markdown";
      default: return "Plain Text";
    }
  };

  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const spaces = " ".repeat(settings.tabSize);
      const newContent = content.substring(0, start) + spaces + content.substring(end);
      onContentChange(newContent);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + settings.tabSize;
      });
    }
  };

  const displayName = (filepath: string) => filepath.split("/").pop() || filepath;

  return (
    <div className="flex-1 flex flex-col bg-[#1E1E1E] min-w-0">
      {/* Tabs */}
      <div className="h-[35px] bg-[#252526] border-b border-[#3E3E42] flex items-center overflow-x-auto scrollbar-none">
        {openFiles.map((file) => (
          <div
            key={file}
            className={`flex items-center gap-1.5 px-3 h-full border-r border-[#3E3E42] cursor-pointer shrink-0 ${
              activeFile === file ? "bg-[#1E1E1E] text-white" : "bg-[#2D2D2D] text-[#858585] hover:text-[#CCCCCC]"
            }`}
            onClick={() => onFileSelect(file)}
          >
            {getFileIcon(file)}
            <span className="text-xs">{displayName(file)}</span>
            <button
              className="hover:bg-[#333333] rounded p-0.5 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(file);
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Editor Area */}
      {openFiles.length > 0 ? (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Line Numbers */}
          {settings.lineNumbers && (
            <div
              ref={lineNumbersRef}
              className="bg-[#1E1E1E] text-[#858585] text-right select-none overflow-hidden border-r border-[#3E3E42]"
              style={{
                fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace",
                fontSize: settings.fontSize,
                lineHeight: "1.6",
                paddingTop: 8,
                paddingRight: 8,
                paddingLeft: 8,
                minWidth: lineCount > 99 ? 56 : 44,
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-[#1E1E1E] text-[#CCCCCC] border-none resize-none outline-none p-2"
            style={{
              fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace",
              fontSize: settings.fontSize,
              lineHeight: "1.6",
              tabSize: settings.tabSize,
              wordWrap: settings.wordWrap ? "break-word" : "normal",
              whiteSpace: settings.wordWrap ? "pre-wrap" : "pre",
            }}
            spellCheck={false}
          />

          {/* Integrated Status Bar (Web3 + Save Status) */}
          <div className="absolute bottom-2 right-4 flex items-center gap-3 select-none pointer-events-none">
            
            {/* Save Status Indicator */}
            {saveStatus !== "idle" && (
              <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded border shadow-sm transition-all duration-300 ${
                saveStatus === "saving" ? "bg-blue-500/10 border-blue-500/50 text-blue-400 animate-pulse" :
                saveStatus === "saved" ? "bg-green-500/10 border-green-500/50 text-green-400" :
                "bg-red-500/10 border-red-500/50 text-red-400"
              }`}>
                {saveStatus === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
                {saveStatus === "saved" && <CheckCircle2 className="w-3 h-3" />}
                {saveStatus === "error" && <AlertCircle className="w-3 h-3" />}
                <span className="uppercase tracking-widest">{saveStatus}</span>
              </div>
            )}

            {/* Web3 Status */}
            <div className="flex items-center gap-1.5 text-[10px] font-medium bg-[#252526] px-2 py-1 rounded border border-[#3E3E42]">
              {isWalletConnected ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-[#4EC9B0]" />
                  <span className="text-[#4EC9B0] uppercase tracking-wider">Secured Session</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3 h-3 text-[#F44747]" />
                  <span className="text-[#858585] uppercase tracking-wider">Wallet Disconnected</span>
                </>
              )}
            </div>
            
            <div className="text-[10px] text-[#858585] bg-[#252526] px-2 py-1 rounded border border-[#3E3E42] uppercase tracking-wider">
              {getLanguage(activeFile)} | Ln {lines.length}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#858585] bg-[#1E1E1E]">
          <div className="text-center space-y-4">
            <div className="text-5xl font-bold text-[#2D2D2D] animate-pulse">ZI</div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Zicon-IDE v1.0.0</p>
              <p className="text-xs opacity-60">Ready for Web3 Development</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}