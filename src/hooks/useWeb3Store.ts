import { create } from 'zustand';
import { ethers } from 'ethers';

interface Web3State {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useWeb3Store = create<Web3State>((set) => ({
  address: null,
  isConnected: false,
  
  connect: async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed!');
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts[0]) {
      set({ address: accounts[0], isConnected: true });
    }
  },
  
  disconnect: () => {
    set({ address: null, isConnected: false });
  },
}));