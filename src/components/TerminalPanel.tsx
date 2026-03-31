import { useEffect, useRef, useCallback } from "react"; 
import { Terminal as XTerminal } from "@xterm/xterm"; 
import { FitAddon } from "@xterm/addon-fit"; 
import "@xterm/xterm/css/xterm.css"; 

interface TerminalPanelProps { 
  onTerminalReady?: (terminal: XTerminal) => void; 
} 

export default function TerminalPanel({ onTerminalReady }: TerminalPanelProps) { 
  const terminalRef = useRef<HTMLDivElement>(null); 
  const xtermRef = useRef<XTerminal | null>(null); 
  const fitAddonRef = useRef<FitAddon | null>(null); 
  const initRef = useRef(false); 

  const initTerminal = useCallback(() => { 
    if (!terminalRef.current || initRef.current) return; 
    initRef.current = true; 

    const xterm = new XTerminal({ 
      theme: { 
        background: "#1E1E1E", 
        foreground: "#CCCCCC", 
        cursor: "#CCCCCC", 
        selectionBackground: "#264F78", 
        black: "#1E1E1E", 
        red: "#F44747", 
        green: "#4EC9B0", 
        yellow: "#DCAA5F", 
        blue: "#007ACC", 
        magenta: "#C586C0", 
        cyan: "#4FC1FF", 
        white: "#CCCCCC", 
        brightBlack: "#858585", 
        brightRed: "#F44747", 
        brightGreen: "#4EC9B0", 
        brightYellow: "#DCAA5F", 
        brightBlue: "#007ACC", 
        brightMagenta: "#C586C0", 
        brightCyan: "#4FC1FF", 
        brightWhite: "#FFFFFF", 
      }, 
      fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace", 
      fontSize: 13, 
      lineHeight: 1.4, 
      cursorBlink: true, 
      convertEol: true, 
      scrollback: 5000, 
    }); 

    const fitAddon = new FitAddon(); 
    xterm.loadAddon(fitAddon); 
    xterm.open(terminalRef.current); 

    // Small delay to ensure DOM is ready before fitting 
    setTimeout(() => { 
      try { 
        fitAddon.fit(); 
      } catch { 
        // ignore fit errors during init 
      } 
    }, 100); 

    xtermRef.current = xterm; 
    fitAddonRef.current = fitAddon; 

    xterm.writeln("\x1b[1;34m Welcome to Zicon-IDE Terminal \x1b[0m"); 
    xterm.writeln(""); 

    if (onTerminalReady) { 
      onTerminalReady(xterm); 
    } 
  }, [onTerminalReady]); 

  useEffect(() => { 
    initTerminal(); 

    const handleResize = () => { 
      if (fitAddonRef.current) { 
        try { 
          fitAddonRef.current.fit(); 
        } catch { 
          // ignore 
        } 
      } 
    }; 

    window.addEventListener("resize", handleResize); 

    // Use ResizeObserver for container resize 
    const observer = new ResizeObserver(() => { 
      handleResize(); 
    }); 

    if (terminalRef.current) { 
      observer.observe(terminalRef.current); 
    } 

    return () => { 
      window.removeEventListener("resize", handleResize); 
      observer.disconnect(); 
    }; 
  }, [initTerminal]); 

  return ( 
    <div className="h-full w-full bg-[#1E1E1E] overflow-hidden"> 
      <div ref={terminalRef} className="h-full w-full" style={{ padding: "4px 8px" }} /> 
    </div> 
  ); 
}
