import { useState, useRef } from "react";
import {
  RefreshCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Loader2,
  Globe,
  ArrowRight,
} from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  isLoading: boolean;
  loadingStage?: string;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_SIZES: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "390px", label: "Mobile" },
};

const QUICK_URLS = [
  { label: "Jupyter",            url: "http://localhost:8888/?token=zicon" },
  { label: "Cursor Download",    url: "https://cursor.com/downloads" },
  { label: "NotebookLM",         url: "https://notebooklm.google.com" },
  { label: "Portainer",          url: "http://localhost:9000"  },
  { label: "Nginx",              url: "http://localhost:8080"  },
  { label: "Tomcat",             url: "http://localhost:8100"  },
  { label: "Apache HTTPD",       url: "http://localhost:8101"  },
  { label: "JBoss/WildFly",      url: "http://localhost:8102"  },
  { label: "Grafana",            url: "http://localhost:3001"  },
  { label: "MongoDB",            url: "http://localhost:8081"  },
  { label: "pgAdmin",            url: "http://localhost:5050"  },
  { label: "Redis",              url: "http://localhost:8083"  },
  { label: "Traefik",            url: "http://localhost:8082"  },
  { label: "Jenkins",            url: "http://localhost:8084"  },
  { label: "MinIO",              url: "http://localhost:9003"  },
  { label: "Gitea",              url: "http://localhost:3003"  },
  { label: "SonarQube",          url: "http://localhost:9001"  },
  { label: "RabbitMQ",           url: "http://localhost:15672" },
  { label: "InfluxDB",           url: "http://localhost:8086"  },
  { label: "WordPress",          url: "http://localhost:8090"  },
  { label: "Ghost",              url: "http://localhost:2368"  },
  { label: "Nextcloud",          url: "http://localhost:8091"  },
  { label: "Prometheus",         url: "http://localhost:9090"  },
  { label: "Kibana",             url: "http://localhost:5601"  },
  { label: "CouchDB",            url: "http://localhost:5984"  },
  { label: "Neo4j",              url: "http://localhost:7474"  },
  { label: "Adminer",            url: "http://localhost:8089"  },
  { label: "phpMyAdmin",         url: "http://localhost:8085"  },
  { label: "MariaDB Admin",      url: "http://localhost:8087"  },
  { label: "MSSQL Adminer",      url: "http://localhost:8099"  },
  { label: "Nginx Proxy Mgr",    url: "http://localhost:8095"  },
  { label: "Pi-hole",            url: "http://localhost:8093"  },
  { label: "NATS",               url: "http://localhost:8222"  },
  { label: "IPFS",               url: "http://localhost:8096"  },
  { label: "Drone CI",           url: "http://localhost:8086"  },
  { label: "Loki",               url: "http://localhost:3100"  },
  { label: "Strapi",             url: "http://localhost:1337"  },
  { label: "FastAPI",            url: "http://localhost:8001"  },
  { label: "Flask",              url: "http://localhost:5002"  },
  { label: ".NET",               url: "http://localhost:8003"  },
  { label: "Rails",              url: "http://localhost:3006"  },
  { label: "Spring Boot",        url: "http://localhost:8004"  },
  { label: "Spark UI",           url: "http://localhost:8005"  },
];

export default function PreviewPanel({ previewUrl, isLoading, loadingStage }: PreviewPanelProps) {
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const displayUrl = activeUrl || previewUrl;

  const navigateTo = (url: string) => {
    const normalized = url.startsWith("http") ? url : `http://${url}`;
    setActiveUrl(normalized);
    setUrlInput("");
    setShowQuick(false);
    setRefreshKey((k) => k + 1);
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && urlInput.trim()) navigateTo(urlInput.trim());
    if (e.key === "Escape") { setUrlInput(""); setShowQuick(false); }
  };

  // Anything that ISN'T the live WebContainer dev server is either a localhost
  // Docker service or an external site (Cursor, NotebookLM) — both typically
  // block iframing via X-Frame-Options/CSP, so show "Open in Browser" for both.
  const isIframeBlocked = (url: string) => url !== previewUrl;

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
      {/* Toolbar */}
      <div className="h-9 bg-[#252526] border-b border-[#3E3E42] flex items-center gap-2 px-3 shrink-0">
        {/* Device switcher */}
        <div className="flex items-center gap-0.5 bg-[#1e1e1e] rounded p-0.5 border border-[#3E3E42]">
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              title={DEVICE_SIZES[d].label}
              className={`p-1 rounded transition-colors ${
                device === d ? "bg-[#007ACC] text-white" : "text-[#858585] hover:text-white"
              }`}
            >
              {d === "desktop" && <Monitor className="w-3 h-3" />}
              {d === "tablet" && <Tablet className="w-3 h-3" />}
              {d === "mobile" && <Smartphone className="w-3 h-3" />}
            </button>
          ))}
        </div>

        {/* URL bar */}
        <div className="flex-1 relative">
          <div className="flex items-center gap-1.5 bg-[#1e1e1e] border border-[#3E3E42] focus-within:border-[#007ACC] rounded px-2 h-6 transition-colors">
            <Globe className="w-3 h-3 text-[#555] shrink-0" />
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              onFocus={() => setShowQuick(true)}
              onBlur={() => setTimeout(() => setShowQuick(false), 150)}
              placeholder={displayUrl || "Type URL e.g. localhost:9000 then Enter"}
              className="flex-1 bg-transparent text-[11px] text-[#CCCCCC] outline-none placeholder:text-[#444] font-mono min-w-0"
            />
            {urlInput && (
              <button
                onClick={() => navigateTo(urlInput)}
                className="text-[#007ACC] hover:text-white transition-colors shrink-0"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick URL dropdown */}
          {showQuick && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#252526] border border-[#3E3E42] rounded shadow-xl z-50 overflow-hidden">
              <div className="px-2 py-1 text-[9px] text-[#555] uppercase tracking-wider border-b border-[#3E3E42]">
                Quick Access
              </div>
              <div className="max-h-48 overflow-y-auto">
                {previewUrl && (
                  <button
                    onMouseDown={() => navigateTo(previewUrl)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] border-b border-[#3E3E42] transition-colors"
                  >
                    <span className="text-[11px] text-green-400">⚡ WebContainer</span>
                    <span className="text-[10px] text-[#555] font-mono truncate max-w-[150px]">{previewUrl}</span>
                  </button>
                )}
                {QUICK_URLS.map((q) => (
                  <button
                    key={q.url}
                    onMouseDown={() => navigateTo(q.url)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] transition-colors"
                  >
                    <span className="text-[11px] text-[#CCCCCC]">{q.label}</span>
                    <span className="text-[10px] text-[#555] font-mono">{q.url.replace("http://", "")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={!displayUrl}
          className="p-1 text-[#858585] hover:text-white disabled:opacity-30 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => displayUrl && window.open(displayUrl, "_blank")}
          disabled={!displayUrl}
          className="p-1 text-[#858585] hover:text-white disabled:opacity-30 transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-[#2d2d2d] flex items-start justify-center p-2">
        {isLoading ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#007ACC] animate-spin" />
            <p className="text-sm text-[#858585]">{loadingStage || "Booting WebContainer..."}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-[#444]">
              <span className={loadingStage?.includes("Booting") ? "text-[#007ACC]" : "text-green-500"}>
                ● Boot
              </span>
              <span>→</span>
              <span className={loadingStage?.includes("Installing") ? "text-[#007ACC]" : loadingStage?.includes("Starting") ? "text-green-500" : ""}>
                ● Install
              </span>
              <span>→</span>
              <span className={loadingStage?.includes("Starting") ? "text-[#007ACC]" : ""}>
                ● Dev Server
              </span>
            </div>
          </div>
        ) : displayUrl && isIframeBlocked(displayUrl) ? (
          // Localhost Docker service — browsers block these in iframes
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl border border-[#3E3E42] bg-[#252526]">
              🌐
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">
                {QUICK_URLS.find((q) => q.url === displayUrl)?.label || "Service"}
              </p>
              <p className="text-xs text-[#858585] font-mono">{displayUrl}</p>
              <p className="text-xs text-[#555] mt-2 max-w-xs">
                Browsers block localhost URLs inside iframes for security reasons.
              </p>
            </div>
            <button
              onClick={() => window.open(displayUrl, "_blank")}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#007ACC] hover:bg-[#005a9e] text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Browser
            </button>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm mt-2">
              {QUICK_URLS.filter((q) => q.url !== displayUrl).slice(0, 5).map((q) => (
                <button
                  key={q.url}
                  onClick={() => navigateTo(q.url)}
                  className="text-[10px] bg-[#252526] border border-[#3E3E42] hover:border-[#007ACC] text-[#858585] hover:text-white px-2 py-1 rounded transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : displayUrl ? (
          // WebContainer URL — safe to iframe
          <div
            className="h-full bg-white shadow-2xl transition-all duration-300 overflow-hidden"
            style={{ width: DEVICE_SIZES[device].width, maxWidth: "100%", minHeight: "100%" }}
          >
            <iframe
              ref={iframeRef}
              key={`${displayUrl}-${refreshKey}`}
              src={displayUrl}
              className="w-full h-full border-0"
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </div>
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#252526] border border-[#3E3E42] flex items-center justify-center">
              <Monitor className="w-8 h-8 text-[#3E3E42]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#555]">No preview running</p>
              <p className="text-xs text-[#3E3E42] mt-1">Hit Run to start your dev server</p>
              <p className="text-xs text-[#3E3E42] mt-1">Or click the URL bar and pick a service</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-xs">
              {QUICK_URLS.slice(0, 6).map((q) => (
                <button
                  key={q.url}
                  onClick={() => navigateTo(q.url)}
                  className="text-[10px] bg-[#252526] border border-[#3E3E42] hover:border-[#007ACC] text-[#858585] hover:text-white px-2 py-1 rounded transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-5 bg-[#007ACC] flex items-center px-3 gap-2 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${displayUrl ? "bg-green-300" : "bg-white/30"}`} />
        <span className="text-[10px] text-white/80 font-mono truncate">
          {displayUrl || "No active preview — type a URL or hit Run"}
        </span>
        {displayUrl && (
          <span className="ml-auto text-[9px] text-white/50 shrink-0">{DEVICE_SIZES[device].label}</span>
        )}
      </div>
    </div>
  );
}
