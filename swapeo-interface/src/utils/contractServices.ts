// src/utils/contractServices.ts
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";
import SwapeoDEX_ABI from "./SwapeoDEX_ABI.json";
import { TOKEN_OPTIONS, CONTRACT_ADDRESS, TOKENS } from "./constants";

let provider: BrowserProvider | undefined;
let signer: any;
let contract: Contract | undefined;
let isInitialized = false;

const switchToSepoliaNetwork = async (): Promise<void> => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  const sepoliaChainId = "0xaa36a7"; // 11155111 en hexadécimal
  const currentChainId = await window.ethereum.request({ method: "eth_chainId" });

  if (currentChainId === sepoliaChainId) {
    return;
  }

  try {
    // Tenter de changer de réseau
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: sepoliaChainId }],
    });
  } catch (error: any) {
    // Si le réseau n'existe pas (code 4902), l'ajouter
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: sepoliaChainId,
              chainName: "Sepolia",
              nativeCurrency: {
                name: "Sepolia ETH",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/XXuXkKK5ykgeiNzxWN5jDdJxMTObRDte"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } catch (addError) {
        console.error("Failed to add Sepolia network:", addError);
        throw addError;
      }
    } else {
      console.error("Failed to switch network:", error);
      throw error;
    }
  }
};

const initialize = async (): Promise<void> => {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }
    
    provider = new BrowserProvider(window.ethereum, {
      name: "Sepolia",
      chainId: 11155111
    });
    
    await switchToSepoliaNetwork();
    
    // Réinitialiser le provider quand l'utilisateur change de compte
    window.ethereum.on('accountsChanged', async (accounts: string[]) => {
      isInitialized = false;
      provider = new BrowserProvider(window.ethereum, {
        name: "Sepolia",
        chainId: 11155111
      });
      signer = await provider.getSigner();
    });

    signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    
    const code = await provider.getCode(CONTRACT_ADDRESS);
    
    if (code.length <= 2) {
      throw new Error(`Aucun contrat trouvé à l'adresse ${CONTRACT_ADDRESS}`);
    }
    
    contract = new Contract(
      CONTRACT_ADDRESS,
      SwapeoDEX_ABI,
      signer
    );
    
    isInitialized = true;
  } catch (error) {
    console.error("Initialization failed:", error);
    isInitialized = false;
    throw error;
  }
};

initialize().catch((error) => console.error("Initial setup failed:", error));

export const requestAccount = async (): Promise<string | null> => {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }

    if (!isInitialized) {
      await initialize();
    }

    if (!provider) {
      throw new Error("Provider not initialized");
    }

    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length === 0) {
      const newAccounts = await provider.send("eth_requestAccounts", []);
      return newAccounts[0];
    }

    return accounts[0];
  } catch (error) {
    console.error("Error requesting account:", error);
    throw error;
  }
};

export const disconnectAccount = async (): Promise<void> => {
  signer = null;
  contract = undefined;
  isInitialized = false;
};

export const getContractBalanceInETH = async (): Promise<string> => {
  try {
    if (!provider) await initialize();
    
    // Vérifier le réseau
    const network = await provider?.getNetwork();
    
    const signerAddress = await signer?.getAddress();
    
    const code = await provider?.getCode(CONTRACT_ADDRESS);
    if (code === '0x') {
      console.error("No contract found at address:", CONTRACT_ADDRESS);
      return "0";
    }
    
    
    // Balance du contrat
    const contractBalance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [CONTRACT_ADDRESS, 'latest']
    });
    
    // Balance du wallet
    const walletBalance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [signerAddress, 'latest']
    });
    
    if (!contractBalance) {
      console.error("No contract balance received");
      return "0";
    }

    // Convertir la valeur hexadécimale en BigInt puis en string formatté
    const balanceInWei = BigInt(contractBalance);
    const formattedBalance = formatUnits(balanceInWei, 18);

    return formattedBalance;
  } catch (error) {
    console.error("Error fetching balance:", error);
    return "0";
  }
};

export const getNetworkStats = async (): Promise<{
  gasPrice: string;
  blockNumber: string;
}> => {
  try {
    if (!provider) await initialize();
    
    const [gasPrice, blockNumber] = await Promise.all([
      provider?.send("eth_gasPrice", []),
      provider?.getBlockNumber()
    ]);

    return {
      gasPrice: gasPrice ? formatUnits(gasPrice, 'gwei') : '0',
      blockNumber: blockNumber?.toString() || '0'
    };
  } catch (error) {
    console.error("Error fetching network stats:", error);
    return {
      gasPrice: '0',
      blockNumber: '0'
    };
  }
};

export const getConversionRate = async (
  tokenA: string,
  tokenB: string,
  amount: string
): Promise<string> => {
  try {
    if (!contract) {
      await initialize();
      if (!contract) {
        throw new Error("Failed to initialize contract");
      }
    }
    const amountInWei = parseUnits(amount, 18);
    const amountOutWei = await contract.getAmountOut(tokenA, tokenB, amountInWei);
    if (amountOutWei === 0n) {
      return "0";
    }
    return formatUnits(amountOutWei, 18);
  } catch (error) {
    console.error("Error fetching conversion rate:", error);
    throw error;
  }
};

export const swapTokens = async (
  tokenA: string,
  tokenB: string,
  amount: string
): Promise<void> => {
  try {
    if (!contract) {
      await initialize();
      if (!contract) {
        throw new Error("Failed to initialize contract");
      }
    }
    const amountInWei = parseUnits(amount, 18);
    const tx = await contract.swap(tokenA, tokenB, amountInWei);
    await tx.wait();
  } catch (error) {
    console.error("Error swapping tokens:", error);
    throw error;
  }
};

export const depositLiquidity = async (
  tokenA: string,
  tokenB: string,
  amountA: string,
  amountB: string
): Promise<void> => {
  try {
    if (!contract) {
      await initialize();
      if (!contract) {
        throw new Error("Failed to initialize contract");
      }
    }
    const amountAWei = parseUnits(amountA, 18);
    const amountBWei = parseUnits(amountB, 18);
    const tx = await contract.deposit(tokenA, tokenB, amountAWei, amountBWei);
    await tx.wait();
  } catch (error) {
    console.error("Error depositing liquidity:", error);
    throw error;
  }
};

export const withdrawLiquidity = async (
  tokenA: string,
  tokenB: string,
  amountA: string
): Promise<void> => {
  try {
    if (!contract) {
      await initialize();
      if (!contract) {
        throw new Error("Failed to initialize contract");
      }
    }
    const amountAWei = parseUnits(amountA, 18);
    const tx = await contract.withdraw(tokenA, tokenB, amountAWei);
    await tx.wait();
  } catch (error) {
    console.error("Error withdrawing liquidity:", error);
    throw error;
  }
};

export const getCollectedFees = async (token: string, account: string): Promise<string> => {
  try {
    if (!contract) {
      await initialize();
      if (!contract) {
        throw new Error("Failed to initialize contract");
      }
    }
    const lpBalance = await contract.lpBalances(token, account);
    const totalFees = await contract.feesCollected(token);
    
    if (lpBalance === 0n || totalFees === 0n) {
      return "0";
    }

    const lpList = await contract.getLPList(token);
    const totalLPBalances = await Promise.all(
      lpList.map((lp: string) => contract!.lpBalances(token, lp))
    );

    const totalLPBalance = totalLPBalances.reduce((a: bigint, b: bigint) => a + b, 0n);
    if (totalLPBalance === 0n) {
      return "0";
    }

    const userShare = (lpBalance * totalFees) / totalLPBalance;
    return formatUnits(userShare, 18);
  } catch (error) {
    console.error("Error getting collected fees:", error);
    return "0";
  }
};

export const approveToken = async (tokenAddress: string, amount: string): Promise<void> => {
  try {
    if (!signer) await initialize();
    
    // ABI spécifique pour ERC20Mock
    const ERC20Mock_ABI = [
      // Lecture
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address account) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      // Écriture
      "function transfer(address to, uint256 amount) returns (bool)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
      // Événements
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Approval(address indexed owner, address indexed spender, uint256 value)"
    ];

    const tokenContract = new Contract(tokenAddress, ERC20Mock_ABI, signer);
    
    try {
      // Vérifier le symbole du token
      const symbol = await tokenContract.symbol();
    } catch (error) {
      console.warn("Could not fetch token symbol:", error);
    }
    
    // Vérifier le solde avant l'approbation
    const balance = await tokenContract.balanceOf(await signer.getAddress());

    // Vérifier l'allowance actuelle
    const currentAllowance = await tokenContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);

    const amountInWei = parseUnits(amount, 18);

    // Effectuer l'approbation
    const tx = await tokenContract.approve(CONTRACT_ADDRESS, amountInWei);
    
    const receipt = await tx.wait();

    // Vérifier la nouvelle allowance
    const newAllowance = await tokenContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);

  } catch (error) {
    console.error("Error in approveToken:", error);
    throw error;
  }
};

export const mintTestTokens = async (): Promise<void> => {
  try {
    if (!signer) await initialize();
    
    const TOKEN_A_ADDRESS = TOKENS.TOKEN_A;
    const TOKEN_B_ADDRESS = TOKENS.TOKEN_B;
    const AMOUNT_A = "4000";
    const AMOUNT_B = "3000";

    const ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
      "function symbol() view returns (string)"
    ];

    // Créer les instances des contrats de tokens
    const tokenA = new Contract(TOKEN_A_ADDRESS, ERC20_ABI, signer);
    const tokenB = new Contract(TOKEN_B_ADDRESS, ERC20_ABI, signer);

    const userAddress = await signer.getAddress();
    const symbolA = await tokenA.symbol();
    const symbolB = await tokenB.symbol();

    // Vérifier les balances actuelles
    const balanceA = await tokenA.balanceOf(userAddress);
    const balanceB = await tokenB.balanceOf(userAddress);


    // Si l'utilisateur a déjà les tokens, ne rien faire
    if (balanceA >= parseUnits(AMOUNT_A, 18) && balanceB >= parseUnits(AMOUNT_B, 18)) {
      return;
    }

    // Si l'utilisateur n'a pas assez de tokens, afficher un message d'erreur
    throw new Error(
      `Pour obtenir des tokens de test sur Sepolia, veuillez contacter le créateur à l'adresse 0xACB24e6B49dA6B83EE259c29FBaF81760A2dF0A5.\n\n` +
      `Tokens nécessaires :\n` +
      `- ${AMOUNT_A} ${symbolA} (${TOKEN_A_ADDRESS})\n` +
      `- ${AMOUNT_B} ${symbolB} (${TOKEN_B_ADDRESS})`
    );

  } catch (error) {
    console.error("Error in mintTestTokens:", error);
    throw error;
  }
};

export const getLiquidityPosition = async (account: string): Promise<{
  tokenAAmount: string;
  tokenBAmount: string;
  poolShare: string;
}> => {
  try {
    if (!contract) {
      await initialize();
    }


    // Utiliser les nouvelles adresses pour les réserves de la pool
    const tokenA = TOKENS.TOKEN_A;
    const tokenB = TOKENS.TOKEN_B;



    const pairKey = await contract?.pairKeys(tokenA, tokenB);

    if (!pairKey || pairKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      return {
        tokenAAmount: "0",
        tokenBAmount: "0",
        poolShare: "0"
      };
    }

    const pair = await contract?.pairs(pairKey);

    // Formater les résultats
    const formattedResult = {
      tokenAAmount: formatUnits(pair?.reserveA || 0, 18),
      tokenBAmount: formatUnits(pair?.reserveB || 0, 18),
      poolShare: "0"
    };

    return formattedResult;

  } catch (error) {
    console.error("Error in getLiquidityPosition:", error);
    return {
      tokenAAmount: "0",
      tokenBAmount: "0",
      poolShare: "0"
    };
  }
};

export const getTokenBalance = async (tokenAddress: string, account: string): Promise<string> => {
  try {
    if (!signer) await initialize();

    // Vérifier que l'adresse du compte est valide
    if (!account) {
      console.warn("No account provided for getTokenBalance");
      return "0";
    }

    // Créer une instance du contrat ERC20
    const tokenABI = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function name() view returns (string)"
    ];
    
    const tokenContract = new Contract(tokenAddress, tokenABI, signer);
    
    // Récupérer les informations du token
    const [symbol, name] = await Promise.all([
      tokenContract.symbol().catch(() => "Unknown"),
      tokenContract.name().catch(() => "Unknown")
    ]);
    
    
    // Récupérer la balance et les décimales
    const signerAddress = await signer.getAddress();
    
    const [balance, decimals] = await Promise.all([
      tokenContract.balanceOf(signerAddress).catch((error: any) => {
        console.error(`Error fetching balance for ${symbol}:`, error);
        return 0n;
      }),
      tokenContract.decimals().catch((error: any) => {
        console.error(`Error fetching decimals for ${symbol}:`, error);
        return 18;
      })
    ]);

    // Formater la balance avec le bon nombre de décimales
    const formattedBalance = formatUnits(balance, decimals);
    
    
    return formattedBalance;
  } catch (error) {
    console.error("Error in getTokenBalance:", error);
    return "0";
  }
};

export const sendETHToContract = async (amount: string): Promise<void> => {
  try {
    if (!signer) await initialize();
    
    const tx = await signer.sendTransaction({
      to: CONTRACT_ADDRESS,
      value: parseUnits(amount, 18)
    });
    
    const receipt = await tx.wait();
    
    // Vérifier le nouveau solde
    const balance = await getContractBalanceInETH();
  } catch (error) {
    console.error("Error sending ETH to contract:", error);
    throw error;
  }
};

export const getAccountBalance = async (): Promise<string> => {
  try {
    if (!signer) await initialize();
    
    const address = await signer.getAddress();

    const balance = await provider?.getBalance(address);

    return balance ? formatUnits(balance, 18) : "0";
  } catch (error) {
    console.error("Erreur lors de la récupération du solde:", error);
    return "0";
  }
};

export const getNetworkName = async (): Promise<string> => {
  try {
    if (!provider) await initialize();
    const network = await provider?.getNetwork();
    return network?.name || "Unknown Network";
  } catch (error) {
    console.error("Erreur lors de la récupération du nom du réseau:", error);
    return "Unknown Network";
  }
};

