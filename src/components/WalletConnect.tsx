import { useState } from 'react';
import { useWeb3Store } from '@/hooks/useWeb3Store';
import { ethers } from 'ethers';

export default function WalletConnect() {
  const { address, isConnected, connect, disconnect } = useWeb3Store();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!address) return;
    setIsLoading(true);

    try {
      // 1. Sign a message
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const message = `Welcome to Zicon! Sign this message to authenticate.\n\nWallet: ${address}`;
      const signature = await signer.signMessage(message);

      console.log('Signature:', signature);
      console.log('Address:', address);

      // 2. Store token (for testing)
      localStorage.setItem('authToken', 'demo-token-' + Date.now());
      localStorage.setItem('walletAddress', address);
      
      alert('Logged in successfully!\n\nSignature: ' + signature.substring(0, 30) + '...');
      
    } catch (error) {
      console.error(error);
      alert('Authentication failed: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('walletAddress');
    disconnect();
  };

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600 font-mono">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      {!localStorage.getItem('authToken') ? (
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? 'Signing...' : 'Sign In'}
        </button>
      ) : (
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}