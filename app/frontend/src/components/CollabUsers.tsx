import { useState, useEffect, useCallback } from "react";
import { Users, Wifi, WifiOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { ethers } from "ethers";

interface User {
  address: string;
  joinedAt: number;
  lastSeen: number;
}

interface CollabUsersProps {
  walletAddress: string | null;
  onConnectWallet: () => void;
}

export default function CollabUsers({ walletAddress, onConnectWallet }: CollabUsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  const joinSession = useCallback(async () => {
    if (!walletAddress) { onConnectWallet(); return; }
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const message = `Join Zicon IDE session — ${new Date().toISOString().split('T')[0]}`;
      const signature = await signer.signMessage(message);
      const res = await fetch("http://localhost:5000/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress, signature, message }),
      });
      const data = await res.json();
      if (data.success) {
        setJoined(true);
        setUsers(data.users);
        toast.success("Joined session!");
      }
    } catch (err: any) {
      if (err.code === 4001) toast.error("Signature rejected.");
      else toast.error("Failed to join session.");
    }
  }, [walletAddress, onConnectWallet]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/session/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
  }, []);

  // Heartbeat every 2 minutes
  useEffect(() => {
    if (!joined || !walletAddress) return;
    const interval = setInterval(async () => {
      try {
        await fetch("http://localhost:5000/api/session/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: walletAddress }),
        });
        fetchUsers();
      } catch {}
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [joined, walletAddress, fetchUsers]);

  // Poll users every 30 seconds
  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  // Leave on unmount
  useEffect(() => {
    return () => {
      if (walletAddress && joined) {
        fetch("http://localhost:5000/api/session/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: walletAddress }),
        }).catch(() => {});
      }
    };
  }, [walletAddress, joined]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copied — share it with your team!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#CCCCCC]">
      {/* Header */}
      <div className="h-9 bg-[#252526] border-b border-[#3E3E42] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#007ACC]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#858585]">
            Connected Users
          </span>
          {users.length > 0 && (
            <span className="text-[9px] bg-[#007ACC]/20 text-[#007ACC] border border-[#007ACC]/30 rounded-full px-1.5 py-0.5 font-mono">
              {users.length}
            </span>
          )}
        </div>
        <div className={`w-2 h-2 rounded-full ${joined ? 'bg-green-400 animate-pulse' : 'bg-[#555]'}`} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Share link */}
        <div className="bg-[#252526] border border-[#3E3E42] rounded-lg p-3">
          <p className="text-[11px] text-[#858585] mb-2">Share this link to invite others:</p>
          <div className="flex items-center gap-2 bg-[#1e1e1e] border border-[#3E3E42] rounded px-2 py-1.5">
            <span className="text-[10px] text-[#4EC9B0] font-mono truncate flex-1">
              {window.location.href}
            </span>
            <button onClick={copyLink} className="shrink-0 text-[#555] hover:text-white transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[9px] text-[#555] mt-1.5">Anyone with this link can join by connecting their MetaMask wallet.</p>
        </div>

        {/* Join button */}
        {!joined && (
          <button
            onClick={joinSession}
            className="w-full py-2 bg-[#007ACC] hover:bg-[#005a9e] text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Wifi className="w-4 h-4" />
            {walletAddress ? 'Join Session' : 'Connect Wallet to Join'}
          </button>
        )}

        {joined && (
          <div className="flex items-center gap-2 text-green-400 text-xs bg-green-950/20 border border-green-900/30 rounded px-3 py-2">
            <Wifi className="w-3.5 h-3.5" />
            You're in the session
          </div>
        )}

        {/* Users list */}
        <div className="space-y-2">
          <p className="text-[10px] text-[#555] uppercase tracking-wider">Active Users</p>
          {users.length === 0 ? (
            <p className="text-[11px] text-[#444] italic">No users connected yet</p>
          ) : (
            users.map((user) => (
              <div key={user.address} className="flex items-center gap-2.5 bg-[#252526] border border-[#3E3E42] rounded px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-[#007ACC]/20 border border-[#007ACC]/30 flex items-center justify-center text-[9px] font-bold text-[#007ACC]">
                  {user.address.slice(2, 4).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-white truncate">
                    {shortAddress(user.address)}
                    {user.address.toLowerCase() === walletAddress?.toLowerCase() && (
                      <span className="ml-1.5 text-[9px] text-[#858585]">(you)</span>
                    )}
                  </p>
                  <p className="text-[9px] text-[#555]">
                    Joined {new Date(user.joinedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
