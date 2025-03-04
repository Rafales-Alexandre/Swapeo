// src/utils/contractServices.ts
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";
import SwapeoDEX_ABI from "./SwapeoDEX_ABI.json";
import { TOKEN_OPTIONS } from "./constants";

const CONTRACT_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

let provider: BrowserProvider | undefined;
let signer: any;
let contract: Contract | undefined;
let isInitialized = false;

const switchToHardhatNetwork = async (): Promise<void> => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  const hardhatChainId = "0x7A69"; // 31337 en hexadécimal
  const currentChainId = await window.ethereum.request({ method: "eth_chainId" });

  if (currentChainId === hardhatChainId) {
    console.log("Already on Hardhat network");
    return;
  }

  try {
    // Tenter de changer de réseau
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hardhatChainId }],
    });
  } catch (error: any) {
    // Si le réseau n'existe pas (code 4902), l'ajouter
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hardhatChainId,
              chainName: "Hardhat Local",
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["http://127.0.0.1:8545"],
            },
          ],
        });
      } catch (addError) {
        console.error("Failed to add Hardhat network:", addError);
        throw addError;
      }
    } else {
      console.error("Failed to switch network:", error);
      throw error;
    }
  }
};

const initialize = async (): Promise<void> => {
  if (isInitialized) return; // Éviter la réinitialisation

  try {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed");
    }
    
    // Configuration du provider sans ENS
    provider = new BrowserProvider(window.ethereum, {
      name: "Hardhat",
      chainId: 31337,
      ensAddress: undefined,
      ensNetwork: undefined
    });
    
    await switchToHardhatNetwork();
    signer = await provider.getSigner();
    
    // Vérifier si le contrat existe
    const code = await provider.getCode(CONTRACT_ADDRESS);
    console.log("Checking contract at address:", CONTRACT_ADDRESS);
    console.log("Contract bytecode length:", code.length);
    
    if (code === "0x") {
      throw new Error(`Aucun contrat trouvé à l'adresse ${CONTRACT_ADDRESS}. Veuillez vérifier l'adresse du déploiement.`);
    }
    
    // Créer le contrat
    contract = new Contract(
      CONTRACT_ADDRESS,
      SwapeoDEX_ABI,
      signer
    );
    
    // Vérifier si le contrat répond en appelant une fonction qui existe certainement
    try {
      const pairKey = await contract.pairKeys(TOKEN_OPTIONS[0].address, TOKEN_OPTIONS[1].address);
      console.log("Contract responds - pair key:", pairKey);
    } catch (error) {
      console.error("Failed to call contract method:", error);
      throw new Error("Le contrat ne répond pas correctement. Veuillez vérifier l'ABI et l'adresse.");
    }
    
    isInitialized = true;
    console.log("Contract initialized successfully at:", CONTRACT_ADDRESS);
  } catch (error) {
    console.error("Initialization failed:", error);
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
  contract = null;
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
    if (!contract) await initialize();
    const amountInWei = parseUnits(amount, 18);
    const amountOutWei = await contract.getAmountOut(tokenA, tokenB, amountInWei);
    if (amountOutWei === 0n) {
      return "0"; // Retourne "0" au lieu de throw pour indiquer aucune liquidité
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
    if (!contract) await initialize();
    const amountInWei = parseUnits(amount, 18);
    const tokenContract = new Contract(tokenA, [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ], signer);
    const balance = await tokenContract.balanceOf(await signer.getAddress());
    const allowance = await tokenContract.allowance(await signer.getAddress(), CONTRACT_ADDRESS);

    if (balance < amountInWei) throw new Error("Insufficient balance");
    if (allowance < amountInWei) throw new Error("Insufficient allowance");

    const tx = await contract.swap(tokenA, tokenB, amountInWei);
    const receipt = await tx.wait();
    console.log("Swap successful, tx hash:", receipt.hash);
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
    if (!contract) await initialize();
    const amountAWei = parseUnits(amountA, 18);
    const amountBWei = parseUnits(amountB, 18);
    const tx = await contract.deposit(tokenA, tokenB, amountAWei, amountBWei);
    await tx.wait();
    console.log("Liquidity deposited");
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
    if (!contract) await initialize();
    const amountAWei = parseUnits(amountA, 18);
    const tx = await contract.withdraw(tokenA, tokenB, amountAWei);
    await tx.wait();
    console.log("Liquidity withdrawn");
  } catch (error) {
    console.error("Error withdrawing liquidity:", error);
    throw error;
  }
};

export const getCollectedFees = async (token: string, account: string): Promise<string> => {
  try {
    if (!contract) await initialize();
    
    // Vérifier que les adresses sont définies
    if (!token || !account) {
      console.error("Missing address");
      return "0";
    }

    // Récupérer les balances
    const lpBalance = await contract.lpBalances(token, account);
    const totalFees = await contract.feesCollected(token);

    if (!lpBalance || lpBalance === 0n) return "0";

    // Récupérer la liste des LP et leurs balances
    const lpList = await contract.getLPList(token);
    const balances = await Promise.all(
      lpList.map((lp: string) => contract.lpBalances(token, lp))
    );
    
    // Calculer la liquidité totale
    const totalLiquidity = balances.reduce((sum: bigint, bal: bigint) => sum + bal, 0n);

    // Calculer la part des frais
    const feeShare = totalLiquidity > 0n ? (lpBalance * totalFees) / totalLiquidity : 0n;
    return formatUnits(feeShare, 18);
  } catch (error) {
    console.error("Error fetching fees:", error);
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

export const mintTestTokens = async (tokenAddress: string, amount: string): Promise<void> => {
  try {
    if (!signer) await initialize();
    console.log(`Checking token balance at address ${tokenAddress}`);
    
    const ERC20Mock_ABI = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address account) view returns (uint256)"
    ];

    const tokenContract = new Contract(tokenAddress, ERC20Mock_ABI, signer);
    const signerAddress = await signer.getAddress();
    
    // Vérifier le symbole du token
    const symbol = await tokenContract.symbol();
    console.log(`Token Symbol: ${symbol}`);
    
    // Vérifier le solde
    const balance = await tokenContract.balanceOf(signerAddress);
    console.log(`Current balance: ${formatUnits(balance, 18)}`);
    
    if (balance === 0n) {
      throw new Error(`Vous n'avez pas de ${symbol}. Veuillez contacter le déployeur du contrat pour obtenir des tokens de test.`);
    }

    console.log(`Vous avez déjà ${formatUnits(balance, 18)} ${symbol}`);

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
    if (!contract) await initialize();
    
    const tokenA = TOKEN_OPTIONS[0].address;
    const tokenB = TOKEN_OPTIONS[1].address;

    // Récupérer les réserves totales
    const pairKey = await contract?.pairKeys(tokenA, tokenB) || "";
    const pair = await contract?.pairs(pairKey) || { reserveA: 0n, reserveB: 0n };
    const totalReserveA = pair.reserveA;
    const totalReserveB = pair.reserveB;

    // Récupérer les balances LP de l'utilisateur
    const lpBalanceA = await contract?.lpBalances(tokenA, account) || 0n;

    // Calculer la part du pool
    let poolShare = "0";
    if (totalReserveA > 0n) {
      const sharePercentage = (lpBalanceA * 100000n) / totalReserveA;
      poolShare = (Number(sharePercentage) / 1000).toString();
    }

    return {
      tokenAAmount: formatUnits(totalReserveA, 18),
      tokenBAmount: formatUnits(totalReserveB, 18),
      poolShare
    };
  } catch (error) {
    console.error("Error fetching liquidity position:", error);
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
    
    const ERC20Mock_ABI = [
      "function balanceOf(address account) view returns (uint256)"
    ];

    const tokenContract = new Contract(tokenAddress, ERC20Mock_ABI, signer);
    const balance = await tokenContract.balanceOf(account);
    return formatUnits(balance, 18);
  } catch (error) {
    console.error("Error getting token balance:", error);
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

