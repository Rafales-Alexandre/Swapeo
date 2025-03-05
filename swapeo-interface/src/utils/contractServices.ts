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
    console.log("Already on Sepolia network");
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
    
    console.log("Initializing provider...");
    provider = new BrowserProvider(window.ethereum, {
      name: "Sepolia",
      chainId: 11155111
    });
    
    await switchToSepoliaNetwork();
    
    // Réinitialiser le provider quand l'utilisateur change de compte
    window.ethereum.on('accountsChanged', async (accounts: string[]) => {
      console.log("Account changed, reinitializing...", accounts[0]);
      isInitialized = false;
      provider = new BrowserProvider(window.ethereum, {
        name: "Sepolia",
        chainId: 11155111
      });
      signer = await provider.getSigner();
    });

    signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    console.log("Initialized with signer address:", signerAddress);
    
    const code = await provider.getCode(CONTRACT_ADDRESS);
    console.log("Contract check:", {
      address: CONTRACT_ADDRESS,
      bytecodeLength: code.length - 2,
      signerAddress: signerAddress
    });
    
    if (code.length <= 2) {
      throw new Error(`Aucun contrat trouvé à l'adresse ${CONTRACT_ADDRESS}`);
    }
    
    contract = new Contract(
      CONTRACT_ADDRESS,
      SwapeoDEX_ABI,
      signer
    );
    
    isInitialized = true;
    console.log("Contract initialized successfully");
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
      console.log("Requesting account connection...");
      const newAccounts = await provider.send("eth_requestAccounts", []);
      console.log("Connected account:", newAccounts[0]);
      return newAccounts[0];
    }

    console.log("Using existing account:", accounts[0]);
    return accounts[0];
  } catch (error) {
    console.error("Error requesting account:", error);
    throw error;
  }
};

export const disconnectAccount = async (): Promise<void> => {
  console.log("Disconnecting wallet...");
  signer = null;
  contract = undefined;
  isInitialized = false;
};

export const getContractBalanceInETH = async (): Promise<string> => {
  try {
    if (!provider) await initialize();
    
    // Vérifier le réseau
    const network = await provider?.getNetwork();
    console.log("Current network:", {
      chainId: network?.chainId.toString(),
      name: network?.name
    });
    
    // Vérifier si le contrat existe
    console.log("Checking addresses:");
    console.log("Contract address:", CONTRACT_ADDRESS);
    const signerAddress = await signer?.getAddress();
    console.log("Signer address:", signerAddress);
    
    const code = await provider?.getCode(CONTRACT_ADDRESS);
    console.log("Contract code length:", code?.length);
    if (code === '0x') {
      console.error("No contract found at address:", CONTRACT_ADDRESS);
      return "0";
    }
    
    // Vérifier les deux balances
    console.log("Fetching balances...");
    
    // Balance du contrat
    const contractBalance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [CONTRACT_ADDRESS, 'latest']
    });
    console.log("Contract raw balance:", contractBalance);
    
    // Balance du wallet
    const walletBalance = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [signerAddress, 'latest']
    });
    console.log("Wallet raw balance:", walletBalance);
    
    if (!contractBalance) {
      console.error("No contract balance received");
      return "0";
    }

    // Convertir la valeur hexadécimale en BigInt puis en string formatté
    const balanceInWei = BigInt(contractBalance);
    const formattedBalance = formatUnits(balanceInWei, 18);
    console.log("Formatted contract balance in ETH:", formattedBalance);

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
    console.log(`Approving token ${tokenAddress} for amount ${amount}`);
    
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
      console.log(`Token Symbol: ${symbol}`);
    } catch (error) {
      console.warn("Could not fetch token symbol:", error);
    }
    
    // Vérifier le solde avant l'approbation
    const balance = await tokenContract.balanceOf(await signer.getAddress());
    console.log(`Current balance: ${formatUnits(balance, 18)}`);

    // Vérifier l'allowance actuelle
    const currentAllowance = await tokenContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
    console.log(`Current allowance: ${formatUnits(currentAllowance, 18)}`);

    const amountInWei = parseUnits(amount, 18);
    console.log(`Approving amount in Wei: ${amountInWei.toString()}`);

    // Effectuer l'approbation
    const tx = await tokenContract.approve(CONTRACT_ADDRESS, amountInWei);
    console.log(`Approval transaction sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`Approval confirmed in block ${receipt.blockNumber}`);

    // Vérifier la nouvelle allowance
    const newAllowance = await tokenContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
    console.log(`New allowance: ${formatUnits(newAllowance, 18)}`);

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

    console.log(`Balances actuelles :`);
    console.log(`${formatUnits(balanceA, 18)} ${symbolA}`);
    console.log(`${formatUnits(balanceB, 18)} ${symbolB}`);

    // Si l'utilisateur a déjà les tokens, ne rien faire
    if (balanceA >= parseUnits(AMOUNT_A, 18) && balanceB >= parseUnits(AMOUNT_B, 18)) {
      console.log("Vous avez déjà suffisamment de tokens");
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
      console.log("Contract not initialized, initializing...");
      await initialize();
    }

    // Vérification du contrat
    console.log("Contract state:", {
      address: CONTRACT_ADDRESS,
      initialized: isInitialized,
      hasContract: !!contract
    });

    // Utiliser les nouvelles adresses pour les réserves de la pool
    const tokenA = TOKENS.TOKEN_A;
    const tokenB = TOKENS.TOKEN_B;

    console.log("Using new token addresses for pool reserves:", {
      tokenA,
      tokenB
    });

    // Vérifier que le contrat a les bonnes méthodes
    console.log("Available contract methods:", {
      hasPairKeys: !!contract?.pairKeys,
      hasPairs: !!contract?.pairs
    });

    // Récupérer la clé de la paire
    console.log("Fetching pair key...");
    const pairKey = await contract?.pairKeys(tokenA, tokenB);
    console.log("Pair key result:", {
      pairKey,
      isNull: !pairKey || pairKey === "0x0000000000000000000000000000000000000000000000000000000000000000"
    });

    // Si pas de paire, retourner des valeurs par défaut
    if (!pairKey || pairKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("No pair found, returning default values");
      return {
        tokenAAmount: "0",
        tokenBAmount: "0",
        poolShare: "0"
      };
    }

    // Récupérer les informations de la paire
    console.log("Fetching pair info...");
    const pair = await contract?.pairs(pairKey);
    console.log("Full pair info:", pair);

    // Formater les résultats
    const formattedResult = {
      tokenAAmount: formatUnits(pair?.reserveA || 0, 18),
      tokenBAmount: formatUnits(pair?.reserveB || 0, 18),
      poolShare: "0"
    };

    console.log("Formatted result:", formattedResult);
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
    
    console.log("Getting balance for:", {
      token: tokenAddress,
      account: account,
      signer: signer ? "initialized" : "not initialized"
    });

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
    
    console.log("Token info:", {
      symbol,
      name,
      address: tokenAddress
    });
    
    // Récupérer la balance et les décimales
    const signerAddress = await signer.getAddress();
    console.log("Checking balance for signer:", signerAddress);
    
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

    console.log(`Raw balance for ${symbol}:`, {
      balance: balance.toString(),
      decimals: decimals,
      account: signerAddress
    });

    // Formater la balance avec le bon nombre de décimales
    const formattedBalance = formatUnits(balance, decimals);
    
    console.log(`Formatted balance for ${symbol}:`, {
      balance: formattedBalance,
      account: signerAddress
    });
    
    return formattedBalance;
  } catch (error) {
    console.error("Error in getTokenBalance:", error);
    return "0";
  }
};

export const sendETHToContract = async (amount: string): Promise<void> => {
  try {
    if (!signer) await initialize();
    
    console.log(`Sending ${amount} ETH to contract...`);
    const tx = await signer.sendTransaction({
      to: CONTRACT_ADDRESS,
      value: parseUnits(amount, 18)
    });
    
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    // Vérifier le nouveau solde
    const balance = await getContractBalanceInETH();
    console.log("New contract balance:", balance, "ETH");
  } catch (error) {
    console.error("Error sending ETH to contract:", error);
    throw error;
  }
};

export const getAccountBalance = async (): Promise<string> => {
  try {
    if (!signer) await initialize();
    
    const address = await signer.getAddress();
    console.log("Adresse du compte:", address);

    const balance = await provider?.getBalance(address);
    console.log("Solde brut récupéré:", balance?.toString());

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

