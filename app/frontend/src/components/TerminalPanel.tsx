import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TerminalPanelProps {
  onTerminalReady: (terminal: Terminal) => void;
  onData?: (data: string) => void;
}

export default function TerminalPanel({ onTerminalReady, onData }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const initTerminal = useCallback(() => {
    if (!containerRef.current) return;

    // Dispose existing
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#007ACC",
        selectionBackground: "#264f78",
        black: "#1e1e1e",
        red: "#f44747",
        green: "#4ec9b0",
        yellow: "#dcdcaa",
        blue: "#569cd6",
        magenta: "#c586c0",
        cyan: "#4fc1ff",
        white: "#d4d4d4",
        brightBlack: "#808080",
        brightRed: "#f44747",
        brightGreen: "#4ec9b0",
        brightYellow: "#dcdcaa",
        brightBlue: "#569cd6",
        brightMagenta: "#c586c0",
        brightCyan: "#4fc1ff",
        brightWhite: "#ffffff",
      },
      scrollback: 5000,
      convertEol: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerRef.current);

    fitAddonRef.current = fitAddon;
    terminalRef.current = terminal;

    // Safe fit helper — xterm's fit addon can crash if called before
    // the renderer has dimensions (container not laid out yet)
    const safeFit = () => {
      try {
        if (!terminalRef.current || !fitAddonRef.current) return;
        const core = (terminalRef.current as any)._core;
        if (!core?._renderService?.dimensions?.css?.cell?.width) return;
        fitAddonRef.current.fit();
      } catch {
        // Ignore fit errors — terminal not ready yet
      }
    };

    // Delay first fit until after the DOM has laid out
    requestAnimationFrame(() => {
      requestAnimationFrame(safeFit);
    });

    terminal.onData((data) => onData?.(data));
    onTerminalReady(terminal);

    // Enable paste via Ctrl+Shift+V and right-click
    containerRef.current?.addEventListener("paste", (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text");
      if (text) terminal.paste(text);
      e.preventDefault();
    });

    // Also handle Ctrl+Shift+V explicitly (some browsers need this)
    containerRef.current?.addEventListener("keydown", (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        navigator.clipboard.readText().then((text) => {
          if (text) terminal.paste(text);
        }).catch(() => {});
        e.preventDefault();
      }
    });

    terminal.writeln("\x1b[1;32m╔═══════════════════════════════════╗\x1b[0m");
    terminal.writeln("\x1b[1;32m║     Zicon IDE — Terminal Ready     ║\x1b[0m");
    terminal.writeln("\x1b[1;32m╚═══════════════════════════════════╝\x1b[0m");
    terminal.writeln("\x1b[90mPress Run to boot WebContainer\x1b[0m\r\n");

    return safeFit;
  }, [onData, onTerminalReady]);

  useEffect(() => {
    const safeFit = initTerminal();

    const observer = new ResizeObserver(() => {
      safeFit?.();
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [initTerminal]);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div ref={containerRef} className="flex-1 p-1 overflow-hidden" />
    </div>
  );
}
