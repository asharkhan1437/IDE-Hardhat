import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
} from "lucide-react";

interface PreviewPanelProps {
  previewUrl: string | null;
  isLoading: boolean;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

export default function PreviewPanel({
  previewUrl,
  isLoading,
}: PreviewPanelProps) {
  const [key, setKey] = useState(0);
  const [urlInput, setUrlInput] = useState(previewUrl || "");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");

  const refreshPreview = () => {
    setKey((prev) => prev + 1);
  };

  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKey((prev) => prev + 1);
  };

  const displayUrl = previewUrl || urlInput || "";

  const getIframeStyle = (): React.CSSProperties => {
    switch (deviceMode) {
      case "mobile":
        return {
          width: 375,
          height: "100%",
          margin: "0 auto",
          border: "2px solid #3E3E42",
          borderRadius: 12,
        };
      case "tablet":
        return {
          width: 768,
          height: "100%",
          margin: "0 auto",
          border: "2px solid #3E3E42",
          borderRadius: 12,
        };
      default:
        return { width: "100%", height: "100%" };
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] border-l border-[#3E3E42]">
      {/* Toolbar */}
      <div className="h-[35px] bg-[#252526] border-b border-[#3E3E42] flex items-center gap-1 px-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshPreview}
          className="text-[#CCCCCC] hover:bg-[#333333] hover:text-white h-7 w-7 p-0"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>

        {/* URL Bar */}
        <form onSubmit={handleUrlSubmit} className="flex-1 mx-1">
          <div className="flex items-center bg-[#1E1E1E] rounded border border-[#3E3E42] h-6 px-2">
            <Globe className="w-3 h-3 text-[#858585] mr-1.5 shrink-0" />
            <input
              value={displayUrl}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-transparent text-[#CCCCCC] text-xs outline-none w-full"
              placeholder="localhost:5173"
            />
          </div>
        </form>

        {/* Device toggles */}
        <div className="flex items-center border-l border-[#3E3E42] pl-1 gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeviceMode("desktop")}
            className={`h-7 w-7 p-0 ${
              deviceMode === "desktop"
                ? "text-[#007ACC]"
                : "text-[#858585] hover:text-[#CCCCCC]"
            } hover:bg-[#333333]`}
            title="Desktop"
          >
            <Monitor className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeviceMode("tablet")}
            className={`h-7 w-7 p-0 ${
              deviceMode === "tablet"
                ? "text-[#007ACC]"
                : "text-[#858585] hover:text-[#CCCCCC]"
            } hover:bg-[#333333]`}
            title="Tablet"
          >
            <Tablet className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeviceMode("mobile")}
            className={`h-7 w-7 p-0 ${
              deviceMode === "mobile"
                ? "text-[#007ACC]"
                : "text-[#858585] hover:text-[#CCCCCC]"
            } hover:bg-[#333333]`}
            title="Mobile"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={openInNewTab}
          className="text-[#CCCCCC] hover:bg-[#333333] hover:text-white h-7 w-7 p-0"
          title="Open in new tab"
          disabled={!previewUrl}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-white overflow-hidden flex items-start justify-center">
        {isLoading ? (
          <div className="flex-1 h-full flex items-center justify-center bg-[#1E1E1E]">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#007ACC] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[#858585] text-sm">Starting dev server...</p>
            </div>
          </div>
        ) : previewUrl ? (
          <iframe
            key={key}
            src={previewUrl}
            style={getIframeStyle()}
            className="border-none bg-white"
            title="preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="flex-1 h-full flex items-center justify-center bg-[#1E1E1E]">
            <div className="text-center space-y-2">
              <Globe className="w-10 h-10 text-[#333333] mx-auto" />
              <p className="text-[#858585] text-sm">
                Click <strong className="text-[#4EC9B0]">Run</strong> to start
                the dev server
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}