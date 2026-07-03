import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  X,
  Settings,
  Copy,
  Trash2,
  Loader2,
  Key,
  ExternalLink,
  FileCode,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIAssistantProps {
  onClose: () => void;
  activeFileName?: string;
  activeFileContent?: string;
}

const API_KEY_STORAGE = "zicon-anthropic-key";
const MODEL = "claude-sonnet-4-6";

export default function AIAssistant({
  onClose,
  activeFileName,
  activeFileContent,
}: AIAssistantProps) {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(API_KEY_STORAGE) || "");
  const [keyInput, setKeyInput] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [includeFile, setIncludeFile] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const saveKey = () => {
    if (!keyInput.trim().startsWith("sk-ant-")) {
      toast.error("That doesn't look like a valid Anthropic API key.", {
        description: "Keys start with 'sk-ant-'",
      });
      return;
    }
    localStorage.setItem(API_KEY_STORAGE, keyInput.trim());
    setApiKey(keyInput.trim());
    setShowKeyInput(false);
    setKeyInput("");
    toast.success("API key saved locally.");
  };

  const clearKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setApiKey("");
    setShowKeyInput(true);
    toast.info("API key removed.");
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      let systemPrompt =
        "You are a helpful coding assistant embedded inside Zicon IDE, a Web3-enabled browser IDE. " +
        "Give concise, practical answers. When sharing code, use markdown code blocks with the language specified.";

      if (includeFile && activeFileContent && activeFileName) {
        systemPrompt += `\n\nThe user currently has this file open: ${activeFileName}\n\n\`\`\`\n${activeFileContent.slice(0, 8000)}\n\`\`\``;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const replyText = data.content
        ?.map((b: any) => (b.type === "text" ? b.text : ""))
        .join("\n") || "(no response)";

      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
    } catch (err: any) {
      toast.error("Claude API error", { description: err.message?.slice(0, 100) });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${err.message || "Request failed"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, apiKey, messages, includeFile, activeFileContent, activeFileName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.info("Chat cleared.");
  };

  // Render message content with basic code-block detection
  const renderContent = (content: string) => {
    const parts = content.split(/```(\w*)\n?([\s\S]*?)```/g);
    const elements: JSX.Element[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        if (parts[i].trim()) {
          elements.push(
            <p key={i} className="whitespace-pre-wrap leading-relaxed">
              {parts[i].trim()}
            </p>
          );
        }
      } else if (i % 3 === 2) {
        const code = parts[i];
        const lang = parts[i - 1];
        elements.push(
          <div key={i} className="relative group">
            <pre className="bg-[#1e1e1e] border border-[#3E3E42] rounded p-3 text-[11px] text-[#9CDCFE] overflow-x-auto font-mono mt-1">
              {code.trim()}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(code.trim());
                toast.success("Code copied!");
              }}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#252526] border border-[#3E3E42] rounded p-1 text-[#858585] hover:text-white"
              title="Copy code"
            >
              <Copy className="w-3 h-3" />
            </button>
            {lang && (
              <span className="absolute top-1.5 left-2 text-[9px] text-[#555] font-mono">{lang}</span>
            )}
          </div>
        );
      }
    }
    return elements;
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#CCCCCC]">
      {/* Header */}
      <div className="h-9 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#D97757]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#858585]">
            AI Assistant
          </span>
          {apiKey && (
            <span className="text-[9px] text-green-400 bg-green-950/30 border border-green-900/40 rounded px-1.5 py-0.5 font-mono">
              {MODEL}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-1 text-[#555] hover:text-white transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowKeyInput((s) => !s)}
            className="p-1 text-[#555] hover:text-white transition-colors"
            title="API key settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-white text-xs px-2 py-1 hover:bg-[#333] rounded transition-colors"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* API Key setup */}
      {showKeyInput && (
        <div className="p-4 border-b border-[#3E3E42] bg-[#252526]">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-3.5 h-3.5 text-[#D97757]" />
            <h3 className="text-xs font-bold text-white">Anthropic API Key</h3>
          </div>
          <p className="text-[11px] text-[#858585] mb-2">
            Stored only in your browser's localStorage — never sent anywhere except api.anthropic.com.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey()}
              placeholder="sk-ant-..."
              className="flex-1 bg-[#1e1e1e] border border-[#3E3E42] rounded px-2 py-1.5 text-xs outline-none focus:border-[#D97757] font-mono"
            />
            <button
              onClick={saveKey}
              className="px-3 py-1.5 bg-[#D97757] hover:bg-[#c2664a] text-white text-xs font-semibold rounded transition-colors"
            >
              Save
            </button>
            {apiKey && (
              <button
                onClick={clearKey}
                className="px-3 py-1.5 bg-[#3E3E42] hover:bg-red-900/50 text-[#CCCCCC] text-xs rounded transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] text-[#007ACC] hover:underline inline-flex items-center gap-1 mt-2"
          >
            Get an API key from console.anthropic.com <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <Bot className="w-12 h-12 text-[#3E3E42]" />
            <div>
              <p className="text-sm font-semibold text-[#555]">Ask Claude anything</p>
              <p className="text-xs text-[#3E3E42] mt-1">
                Code help, debugging, explanations — with context from your open file
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-[#094771] text-white"
                  : "bg-[#252526] border border-[#3E3E42] text-[#CCCCCC]"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="space-y-2">{renderContent(msg.content)}</div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#252526] border border-[#3E3E42] rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D97757]" />
              <span className="text-xs text-[#858585]">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Context toggle */}
      {activeFileName && (
        <div className="px-3 pt-2">
          <button
            onClick={() => setIncludeFile((s) => !s)}
            className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border transition-colors ${
              includeFile
                ? "border-[#D97757]/40 bg-[#D97757]/10 text-[#D97757]"
                : "border-[#3E3E42] text-[#555] hover:text-[#858585]"
            }`}
          >
            {includeFile ? <Check className="w-3 h-3" /> : <FileCode className="w-3 h-3" />}
            {includeFile ? "Including" : "Include"} {activeFileName}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-[#3E3E42] flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={apiKey ? "Ask about your code... (Enter to send)" : "Set your API key above first"}
          disabled={!apiKey || loading}
          rows={2}
          className="flex-1 bg-[#1e1e1e] border border-[#3E3E42] rounded px-3 py-2 text-sm outline-none focus:border-[#D97757] resize-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={!apiKey || loading || !input.trim()}
          className="px-3 bg-[#D97757] hover:bg-[#c2664a] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
