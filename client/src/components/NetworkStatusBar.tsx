import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface NetworkStatus {
  name: string;
  status: "connected" | "syncing" | "offline";
  latency: number;
}

export default function NetworkStatusBar() {
  const [networks, setNetworks] = useState<NetworkStatus[]>([
    { name: "Midnight", status: "syncing", latency: 0 },
    { name: "Cardano", status: "syncing", latency: 0 },
  ]);
  const [expanded, setExpanded] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    // Check server status
    const checkServer = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/health');
        setServerStatus(response.ok ? 'online' : 'offline');
      } catch {
        setServerStatus('offline');
      }
    };
    
    checkServer();
    const interval = setInterval(checkServer, 10000);
    
    const timer = setTimeout(() => {
      setNetworks([
        { name: "Midnight", status: "connected", latency: 45 },
        { name: "Cardano", status: "connected", latency: 120 },
      ]);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const allConnected = networks.every(n => n.status === "connected");

  return (
    <div className="fixed top-20 right-4 z-40">
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-xl border border-white/[0.08] text-[11px] hover:border-white/15 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${allConnected ? 'bg-green-400' : 'bg-yellow-400'} ${!allConnected && 'animate-pulse'}`} />
        <span className="text-zinc-500">
          {allConnected ? 'Connected' : 'Syncing...'}
        </span>
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 p-3 rounded-xl bg-black/90 backdrop-blur-xl border border-white/[0.08] min-w-[180px]"
          >
            <div className="space-y-2">
              {/* Server Status */}
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/5">
                <span className="text-xs text-zinc-400">API Server</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${serverStatus === 'online' ? 'text-green-400' : serverStatus === 'offline' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {serverStatus === 'online' ? 'Online' : serverStatus === 'offline' ? 'Offline' : 'Checking...'}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-green-400' : serverStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
                </div>
              </div>
              
              {/* Network Status */}
              {networks.map((network, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-zinc-400">{network.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600">{network.latency}ms</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      network.status === 'connected' ? 'bg-green-400' : 'bg-yellow-400'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
