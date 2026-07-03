import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { toast } from "sonner";

// Your receiving wallet on Sepolia — change this to your own wallet address
export const STORE_WALLET = "0xA9FAABCD9372AA1FCD175c3f1a7CfA0b0f8a7916";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export interface Web3State {
  address: string | null;
  balance: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: string | null;
  isWrongNetwork: boolean;
}

export function useWeb3() {
  const [state, setState] = useState<Web3State>({
    address: null,
    balance: null,
    isConnected: false,
    isConnecting: false,
    chainId: null,
    isWrongNetwork: false,
  });

  const getProvider = () => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
  };

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const provider = getProvider();
      if (!provider) return;
      const bal = await provider.getBalance(address);
      return ethers.formatEther(bal).slice(0, 6);
    } catch {
      return "0.00";
    }
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError: any) {
      // Chain not added to MetaMask — add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID,
              chainName: "Sepolia Test Network",
              nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.ankr.com/eth_sepolia"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error("MetaMask not found. Please install it.", {
        description: "Visit metamask.io to install the extension.",
        action: {
          label: "Install",
          onClick: () => window.open("https://metamask.io", "_blank"),
        },
      });
      return;
    }

    setState((s) => ({ ...s, isConnecting: true }));

    try {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const chainId: string = await window.ethereum.request({
        method: "eth_chainId",
      });

      if (chainId !== SEPOLIA_CHAIN_ID) {
        toast.warning("Switching to Sepolia testnet...");
        await switchToSepolia();
      }

      const address = accounts[0];
      const balance = await fetchBalance(address);

      setState({
        address,
        balance: balance ?? null,
        isConnected: true,
        isConnecting: false,
        chainId: SEPOLIA_CHAIN_ID,
        isWrongNetwork: false,
      });

      toast.success("Wallet connected!", {
        description: `${address.slice(0, 6)}...${address.slice(-4)} on Sepolia`,
      });
    } catch (err: any) {
      setState((s) => ({ ...s, isConnecting: false }));
      if (err.code === 4001) {
        toast.error("Connection rejected by user.");
      } else {
        toast.error("Failed to connect wallet.");
      }
    }
  }, [fetchBalance, switchToSepolia]);

  const disconnectWallet = useCallback(() => {
    setState({
      address: null,
      balance: null,
      isConnected: false,
      isConnecting: false,
      chainId: null,
      isWrongNetwork: false,
    });
    toast.info("Wallet disconnected.");
  }, []);

  // Purchase an extension — sends ETH on Sepolia
  const purchaseExtension = useCallback(
    async (
      extensionId: string,
      priceEth: string
    ): Promise<{ success: boolean; txHash?: string }> => {
      if (!state.address) {
        toast.error("Connect your wallet first.");
        return { success: false };
      }

      try {
        const provider = getProvider();
        if (!provider) throw new Error("No provider");

        const signer = await provider.getSigner();
        const weiValue = ethers.parseEther(priceEth);

        toast.loading(`Confirm purchase in MetaMask...`, { id: "tx-pending" });

        const tx = await signer.sendTransaction({
          to: STORE_WALLET,
          value: weiValue,
        });

        toast.loading(`Transaction sent, waiting for confirmation...`, {
          id: "tx-pending",
        });

        const receipt = await tx.wait();
        toast.dismiss("tx-pending");

        if (receipt?.status === 1) {
          // Verify on our backend
          const res = await fetch("http://localhost:5000/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txHash: tx.hash,
              address: state.address,
              extensionId,
            }),
          });

          const data = await res.json();
          if (data.success) {
            // Persist to localStorage
            const owned = JSON.parse(
              localStorage.getItem("owned_extensions") || "[]"
            );
            if (!owned.includes(extensionId)) {
              owned.push(extensionId);
              localStorage.setItem("owned_extensions", JSON.stringify(owned));
            }
            toast.success("Extension purchased!", {
              description: `Tx: ${tx.hash.slice(0, 10)}...`,
            });
            return { success: true, txHash: tx.hash };
          } else {
            toast.error("Payment verification failed on server.");
            return { success: false };
          }
        } else {
          toast.error("Transaction failed on-chain.");
          return { success: false };
        }
      } catch (err: any) {
        toast.dismiss("tx-pending");
        if (err.code === 4001 || err.code === "ACTION_REJECTED") {
          toast.error("Transaction rejected by user.");
        } else {
          toast.error(`Purchase failed: ${err.message?.slice(0, 60)}`);
        }
        return { success: false };
      }
    },
    [state.address]
  );

  const checkOwnership = useCallback((extensionId: string): boolean => {
    const owned = JSON.parse(
      localStorage.getItem("owned_extensions") || "[]"
    );
    return owned.includes(extensionId);
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (state.isConnected) {
        setState((s) => ({ ...s, address: accounts[0] }));
        fetchBalance(accounts[0]).then((bal) =>
          setState((s) => ({ ...s, balance: bal ?? null }))
        );
      }
    };

    const handleChainChanged = (chainId: string) => {
      const isWrong = chainId !== SEPOLIA_CHAIN_ID;
      setState((s) => ({ ...s, chainId, isWrongNetwork: isWrong }));
      if (isWrong) {
        toast.warning("Wrong network! Please switch to Sepolia.", {
          action: {
            label: "Switch",
            onClick: switchToSepolia,
          },
        });
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [state.isConnected, disconnectWallet, fetchBalance, switchToSepolia]);

  return {
    ...state,
    connectWallet,
    disconnectWallet,
    purchaseExtension,
    checkOwnership,
    switchToSepolia,
  };
}

// Extend window type for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
