// src/utils/contractServices.ts
import { BrowserProvider, Contract, parseUnits, formatUnits, keccak256, solidityPacked } from "ethers";
import SwapeoDEX_ABI from "./SwapeoDEX_ABI.json";
import { TOKEN_OPTIONS, CONTRACT_ADDRESS, TOKENS } from "./constants";

let provider: BrowserProvider | undefined;
let signer: any;
let contract: Contract | undefined;
let isInitialized = false;

const switchToSepoliaNetwork = async (): Promise<void> => {
  if (!window.ethereum) {
    throw new Error("MetaMask n'est pas installé");
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
              rpcUrls: [`https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY || ''}`],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } catch (addError) {
        console.error("Échec de l'ajout du réseau Sepolia:", addError);
        throw addError;
      }
    } else {
      console.error("Échec du changement de réseau:", error);
      throw error;
    }
  }
};

const initialize = async (): Promise<void> => {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask n'est pas installé");
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
    console.error("Échec de l'initialisation:", error);
    throw error;
  }
};

initialize().catch((error) => console.error("Initial setup failed:", error));

export const requestAccount = async (): Promise<string | null> => {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask n'est pas installé");
    }
    
    if (!isInitialized) {
      await initialize();
    }
    
    if (!provider) {
      throw new Error("Le provider n'est pas initialisé");
    }
    
    const accounts = await provider.send("eth_requestAccounts", []);
    if (accounts.length > 0) {
      return accounts[0];
    }
    return null;
  } catch (error) {
    console.error("Erreur lors de la demande de compte:", error);
    return null;
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
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    console.log("Calcul du taux de conversion entre:", {
      tokenA,
      tokenB,
      amount
    });
    
    // Utiliser getAmountOut qui est la fonction correcte dans l'ABI du contrat
    const amountInWei = parseUnits(amount, 18);
    const amountOutWei = await contract.getAmountOut(tokenA, tokenB, amountInWei);
    
    if (amountOutWei === 0n) {
      console.log("Montant de sortie est 0");
      return "0";
    }
    
    const formattedAmount = formatUnits(amountOutWei, 18);
    console.log("Montant de sortie formaté:", formattedAmount);
    
    // Le taux de conversion est le montant de sortie divisé par le montant d'entrée
    const rate = Number(formattedAmount) / Number(amount);
    console.log("Taux de conversion calculé:", rate);
    
    return rate.toString();
  } catch (error) {
    console.error("Erreur lors du calcul du taux de conversion:", error);
    return "0";
  }
};

// ABI minimal pour le routeur Uniswap V2
const UNISWAP_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

// Fonction pour échanger directement via le routeur Uniswap
export const swapWithUniswapRouter = async (
  tokenA: string,
  tokenB: string,
  amount: string
): Promise<void> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!signer) {
    throw new Error("Le signer n'est pas initialisé");
  }
  
  try {
    // Récupérer l'adresse du routeur Uniswap utilisé par notre contrat
    const routerAddress = await contract?.uniswapV2Router();
    console.log("Adresse du routeur Uniswap utilisé:", routerAddress);
    
    // Créer une instance du routeur Uniswap
    const uniswapRouter = new Contract(routerAddress, UNISWAP_ROUTER_ABI, signer);
    
    // Convertir le montant en wei
    const amountInWei = parseUnits(amount, 18);
    
    // Définir le chemin de swap
    const path = [tokenA, tokenB];
    
    // Récupérer une estimation du montant de sortie
    const amountsOut = await uniswapRouter.getAmountsOut(amountInWei, path);
    console.log("Estimation des montants de sortie:", amountsOut.map((a: bigint) => a.toString()));
    
    // Calculer un minAmountOut avec 5% de slippage
    const minAmountOut = amountsOut[1] * 95n / 100n; // 95% du montant estimé
    
    // Définir une deadline de 20 minutes
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
    
    // Approuver d'abord le routeur Uniswap pour utiliser nos tokens
    await approveToken(tokenA, amount, routerAddress);
    
    // Exécuter le swap
    console.log("Exécution du swap via le routeur Uniswap directement");
    console.log("Montant d'entrée:", amountInWei.toString());
    console.log("Montant de sortie minimum:", minAmountOut.toString());
    console.log("Chemin:", path);
    console.log("Adresse destinataire:", await signer.getAddress());
    console.log("Deadline:", deadline);
    
    const tx = await uniswapRouter.swapExactTokensForTokens(
      amountInWei,
      minAmountOut,
      path,
      await signer.getAddress(),
      deadline
    );
    
    console.log("Transaction envoyée:", tx.hash);
    await tx.wait();
    console.log("Transaction confirmée");
  } catch (error) {
    console.error("Erreur lors de l'échange direct via Uniswap:", error);
    throw error;
  }
};

// Fonction pour approuver un token pour un spender spécifique
export const approveToken = async (
  tokenAddress: string, 
  amount: string, 
  spenderAddress: string = CONTRACT_ADDRESS
): Promise<void> => {
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
    const currentAllowance = await tokenContract.allowance(await signer.getAddress(), spenderAddress);

    const amountInWei = parseUnits(amount, 18);

    // Effectuer l'approbation
    const tx = await tokenContract.approve(spenderAddress, amountInWei);
    
    const receipt = await tx.wait();

    // Vérifier la nouvelle allowance
    const newAllowance = await tokenContract.allowance(await signer.getAddress(), spenderAddress);

  } catch (error) {
    console.error("Error in approveToken:", error);
    throw error;
  }
};

export const swapTokens = async (
  tokenA: string,
  tokenB: string,
  amount: string
): Promise<{success: boolean, uniswapFallback: boolean, directUniswap: boolean, error?: string}> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Essayer d'abord avec la méthode swap
    const tx = await contract.swap(tokenA, tokenB, parseUnits(amount, 18));
    await tx.wait();
    return { success: true, uniswapFallback: false, directUniswap: false };
  } catch (error: any) {
    // Vérifier si l'erreur est spécifique au manque de liquidité
    if (error.message && (
      error.message.includes("Paire inexistante ou sans liquidite") ||
      error.message.includes("utilisez forwardToUniswap")
    )) {
      console.log("Paire sans liquidité, tentative de transfert vers Uniswap...");
      
      try {
        // Utiliser forwardToUniswap comme première solution de secours
        await forwardToUniswap(tokenA, tokenB, amount);
        return { success: true, uniswapFallback: true, directUniswap: false };
      } catch (uniswapError: any) {
        console.error("Erreur lors du transfert vers Uniswap via le contrat:", uniswapError);
        
        try {
          // Dernière tentative : utiliser directement le routeur Uniswap
          console.log("Tentative d'échange direct via le routeur Uniswap...");
          await swapWithUniswapRouter(tokenA, tokenB, amount);
          return { success: true, uniswapFallback: false, directUniswap: true };
        } catch (directUniswapError: any) {
          console.error("Échec de toutes les méthodes d'échange:", directUniswapError);
          return { 
            success: false, 
            uniswapFallback: false, 
            directUniswap: false,
            error: "Échec de toutes les méthodes d'échange: " + directUniswapError.message
          };
        }
      }
    } else {
      // Pour les autres types d'erreurs, propager l'erreur
      console.error("Erreur lors de l'échange:", error);
      return { 
        success: false, 
        uniswapFallback: false, 
        directUniswap: false,
        error: error.message || "Erreur lors de l'échange" 
      };
    }
  }
};

export const depositLiquidity = async (
  tokenA: string,
  tokenB: string,
  amountA: string,
  amountB: string
): Promise<void> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Utiliser deposit au lieu de addLiquidity
    const tx = await contract.deposit(
      tokenA,
      tokenB,
      parseUnits(amountA, 18),
      parseUnits(amountB, 18)
    );
    await tx.wait();
  } catch (error) {
    console.error("Erreur lors du dépôt de liquidité:", error);
    throw error;
  }
};

export const withdrawLiquidity = async (
  tokenA: string,
  tokenB: string,
  amountA: string
): Promise<void> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Utiliser withdraw au lieu de removeLiquidity
    const tx = await contract.withdraw(tokenA, tokenB, parseUnits(amountA, 18));
    await tx.wait();
  } catch (error) {
    console.error("Erreur lors du retrait de liquidité:", error);
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

    console.log("Récupération des positions de liquidité pour le compte:", account);

    // Utiliser les anciennes adresses qui semblent mieux fonctionner avec le contrat
    const tokenA = TOKENS.TOKEN_A_OLD;
    const tokenB = TOKENS.TOKEN_B_OLD;

    console.log("Utilisation des anciennes adresses:");
    console.log("Token A (OLD):", tokenA);
    console.log("Token B (OLD):", tokenB);

    // Récupérer la clé de la paire
    const pairKey = await contract?.pairKeys(tokenA, tokenB);
    console.log("Pair Key:", pairKey);

    if (!pairKey || pairKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("Pair Key invalide, la paire n'existe peut-être pas");
      return {
        tokenAAmount: "0",
        tokenBAmount: "0",
        poolShare: "0"
      };
    }

    // Récupérer les données de la paire
    const pair = await contract?.pairs(pairKey);
    
    // Utiliser un format manuel pour afficher les données de la paire sans utiliser JSON.stringify sur des BigInt
    console.log("Données de la paire:", {
      tokenA: pair?.tokenA,
      tokenB: pair?.tokenB,
      reserveA: pair?.reserveA ? pair.reserveA.toString() : "0",
      reserveB: pair?.reserveB ? pair.reserveB.toString() : "0"
    });

    // Récupérer le solde LP de l'utilisateur en vérifiant les deux tokens
    const userLPBalanceA = await contract?.lpBalances(tokenA, account);
    const userLPBalanceB = await contract?.lpBalances(tokenB, account);
    
    console.log("Balance LP utilisateur pour TokenA:", userLPBalanceA.toString());
    console.log("Balance LP utilisateur pour TokenB:", userLPBalanceB.toString());
    
    // Utiliser le plus grand des deux soldes car ils devraient être identiques
    const userLPBalance = userLPBalanceA > userLPBalanceB ? userLPBalanceA : userLPBalanceB;
    console.log("Balance LP utilisateur finale:", userLPBalance.toString());
    
    // Si l'utilisateur n'a pas de liquidité, retourner 0 pour éviter des calculs inutiles
    if (userLPBalance === 0n) {
      console.log("L'utilisateur n'a pas de liquidité dans cette paire");
      return {
        tokenAAmount: formatUnits(pair?.reserveA || 0, 18),
        tokenBAmount: formatUnits(pair?.reserveB || 0, 18), 
        poolShare: "0"
      };
    }
    
    // Récupérer la liste des fournisseurs de liquidité pour chaque token
    console.log("Récupération des listes de fournisseurs de liquidité...");
    const lpListA = await contract?.getLPList(tokenA);
    const lpListB = await contract?.getLPList(tokenB);
    
    console.log("Fournisseurs pour TokenA:", lpListA);
    console.log("Fournisseurs pour TokenB:", lpListB);
    
    // Fusionner les listes et supprimer les doublons
    const lpList = [...new Set([...lpListA, ...lpListB])];
    console.log("Liste combinée de fournisseurs:", lpList);
    
    // Récupérer les soldes LP de tous les fournisseurs
    console.log("Calcul des soldes LP totaux...");
    const totalLPBalances = await Promise.all(
      lpList.map(async (lp: string) => {
        const balanceA = await contract!.lpBalances(tokenA, lp);
        const balanceB = await contract!.lpBalances(tokenB, lp);
        // Prendre le plus grand des deux soldes pour chaque fournisseur
        return balanceA > balanceB ? balanceA : balanceB;
      })
    );
    
    // Convertir les BigInt en chaînes pour l'affichage
    console.log("Soldes LP individuels:", totalLPBalances.map(b => b.toString()));
    
    // Calculer le total des soldes LP
    const totalLPBalance = totalLPBalances.reduce((a: bigint, b: bigint) => a + b, 0n);
    console.log("Solde LP total dans la pool:", totalLPBalance.toString());
    
    // Calculer la part de la pool en pourcentage
    let poolShare = "0";
    if (totalLPBalance > 0n) {
      // Calculer la part en pourcentage avec une précision de 2 décimales
      const share = (userLPBalance * 10000n) / totalLPBalance;
      poolShare = (Number(share) / 100).toString();
      console.log("Part calculée (valeur brute):", share.toString());
      console.log("Part de pool formatée (%):", poolShare);
    }

    // Calculer la valeur des tokens correspondant à la part de l'utilisateur
    let userTokenAAmount = 0n;
    let userTokenBAmount = 0n;
    
    if (pair && pair.reserveA && totalLPBalance > 0n) {
      userTokenAAmount = (BigInt(pair.reserveA) * userLPBalance) / totalLPBalance;
    }
    
    if (pair && pair.reserveB && totalLPBalance > 0n) {
      userTokenBAmount = (BigInt(pair.reserveB) * userLPBalance) / totalLPBalance;
    }
    
    console.log("Part de l'utilisateur dans TokenA:", formatUnits(userTokenAAmount, 18));
    console.log("Part de l'utilisateur dans TokenB:", formatUnits(userTokenBAmount, 18));

    // Formater les résultats finaux
    const formattedResult = {
      tokenAAmount: formatUnits(pair?.reserveA || 0, 18),
      tokenBAmount: formatUnits(pair?.reserveB || 0, 18),
      poolShare
    };

    console.log("Résultat final:", formattedResult);
    return formattedResult;

  } catch (error) {
    console.error("Erreur dans getLiquidityPosition:", error);
    return {
      tokenAAmount: "0",
      tokenBAmount: "0",
      poolShare: "0"
    };
  }
};

export const getTokenBalance = async (tokenAddress: string, account: string): Promise<string> => {
  try {
    if (!isInitialized) {
      console.log("Initialisation du signer...");
      await initialize();
    }

    console.log("Vérification du solde pour le token:", tokenAddress);
    console.log("Compte:", account);

    // Vérifier que l'adresse du compte est valide
    if (!account) {
      console.warn("Aucun compte fourni pour getTokenBalance");
      return "0";
    }

    // Vérifier que l'adresse du token est valide
    if (!tokenAddress) {
      console.warn("Aucune adresse de token fournie pour getTokenBalance");
      return "0";
    }

    // Créer une instance du contrat ERC20 avec un ABI minimal
    const tokenABI = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function name() view returns (string)"
    ];
    
    console.log("Création du contrat token avec l'adresse:", tokenAddress);
    
    try {
      // Utilisons provider au lieu de signer pour les appels en lecture seule
      const tokenContract = new Contract(tokenAddress, tokenABI, provider);
      
      // Récupérer les informations du token
      console.log("Récupération des informations du token...");
      let symbol = "Unknown";
      let name = "Unknown";
      let decimals = 18;
      
      try {
        symbol = await tokenContract.symbol();
        console.log("Symbole récupéré:", symbol);
      } catch (e) {
        console.error("Erreur lors de la récupération du symbole:", e);
      }
      
      try {
        name = await tokenContract.name();
        console.log("Nom récupéré:", name);
      } catch (e) {
        console.error("Erreur lors de la récupération du nom:", e);
      }
      
      try {
        decimals = await tokenContract.decimals();
        console.log("Décimales récupérées:", decimals);
      } catch (e) {
        console.error("Erreur lors de la récupération des décimales, utilisation de la valeur par défaut (18):", e);
      }
      
      console.log("Informations du token:", { symbol, name, decimals });
      
      // Récupérer la balance avec un try/catch spécifique
      console.log("Récupération de la balance pour le compte:", account);
      try {
        const balance = await tokenContract.balanceOf(account);
        console.log("Balance brute récupérée:", balance.toString());
        
        // Formater la balance avec le bon nombre de décimales
        const formattedBalance = formatUnits(balance, decimals);
        console.log("Balance formatée:", formattedBalance);
        
        return formattedBalance;
      } catch (error: any) {
        console.error("Erreur spécifique lors de la récupération de la balance:", error);
        
        // Si c'est une erreur de fonction non trouvée, le contrat n'est probablement pas un ERC20
        if (error.message && typeof error.message === 'string' && error.message.includes("function selector was not recognized")) {
          console.error("Ce contrat ne semble pas être un token ERC20 standard");
        }
        
        return "0";
      }
    } catch (contractError) {
      console.error("Erreur lors de l'interaction avec le contrat token:", contractError);
      return "0";
    }
  } catch (error) {
    console.error("Erreur dans getTokenBalance:", error);
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

export const getAccountInfo = async (): Promise<void> => {
  try {
    if (!signer) await initialize();
    
    const account = await signer.getAddress();
    console.log("\n=== INFORMATIONS DU COMPTE CONNECTÉ ===");
    console.log("Adresse:", account);
    
    // Balance ETH
    const ethBalance = await getAccountBalance();
    console.log("\nBalance ETH:", ethBalance);
    
    // Balance des tokens
    console.log("\n=== BALANCES DES TOKENS ===");
    const tokenA = TOKENS.TOKEN_A;
    const tokenB = TOKENS.TOKEN_B;
    
    const tokenABalance = await getTokenBalance(tokenA, account);
    const tokenBBalance = await getTokenBalance(tokenB, account);
    
    console.log("Token A Balance:", tokenABalance);
    console.log("Token B Balance:", tokenBBalance);
    
    // Position de liquidité
    console.log("\n=== POSITION DE LIQUIDITÉ ===");
    const liquidityPosition = await getLiquidityPosition(account);
    console.log("Token A dans la pool:", liquidityPosition.tokenAAmount);
    console.log("Token B dans la pool:", liquidityPosition.tokenBAmount);
    console.log("Part de la pool:", liquidityPosition.poolShare + "%");
    
    // Allowances
    console.log("\n=== ALLOWANCES ===");
    const tokenAContract = new Contract(tokenA, [
      "function allowance(address owner, address spender) view returns (uint256)"
    ], signer);
    
    const tokenBContract = new Contract(tokenB, [
      "function allowance(address owner, address spender) view returns (uint256)"
    ], signer);
    
    const [allowanceA, allowanceB] = await Promise.all([
      tokenAContract.allowance(account, CONTRACT_ADDRESS),
      tokenBContract.allowance(account, CONTRACT_ADDRESS)
    ]);
    
    console.log("Allowance Token A:", formatUnits(allowanceA, 18));
    console.log("Allowance Token B:", formatUnits(allowanceB, 18));
    
    // Fees collectées
    console.log("\n=== FEES COLLECTÉES ===");
    const feesA = await getCollectedFees(tokenA, account);
    const feesB = await getCollectedFees(tokenB, account);
    console.log("Fees Token A:", feesA);
    console.log("Fees Token B:", feesB);
    
    console.log("\n=== FIN DES INFORMATIONS ===\n");
  } catch (error) {
    console.error("Erreur lors de la récupération des informations du compte:", error);
  }
};

/**
 * Calcule la clé d'une paire de tokens de la même manière que le contrat.
 * On normalise en minuscules et on compare les chaînes.
 */
export const getPairKey = (tokenA: string, tokenB: string): string => {
  const aLower = tokenA.toLowerCase();
  const bLower = tokenB.toLowerCase();
  // On compare les chaînes normalisées pour déterminer l'ordre
  const [first, second] = aLower < bLower ? [tokenA, tokenB] : [tokenB, tokenA];
  return keccak256(solidityPacked(["address", "address"], [first, second]));
};

/**
 * Récupère les balances des tokens dans la pool directement depuis le contrat
 */
export const getPoolTokenBalances = async (): Promise<{ tokenABalance: string; tokenBBalance: string }> => {
  try {
    if (!isInitialized) {
      console.log("Initialisation nécessaire...");
      await initialize();
    }
    
    if (!contract) {
      console.error("Le contrat n'est pas initialisé");
      return { tokenABalance: "0", tokenBBalance: "0" };
    }

    // Essayons d'abord avec les anciennes adresses puisque ce sont celles qui fonctionnent pour le taux d'échange
    console.log("Essai d'abord avec les anciennes adresses");
    console.log("Token A (old):", TOKENS.TOKEN_A_OLD);
    console.log("Token B (old):", TOKENS.TOKEN_B_OLD);
    
    try {
      // Tentative 1: Utiliser les anciennes adresses pour la paire
      const pairKeyOld = getPairKey(TOKENS.TOKEN_A_OLD, TOKENS.TOKEN_B_OLD);
      console.log("Clé de paire (anciennes adresses):", pairKeyOld);
      
      const pairDataOld = await contract.pairs(pairKeyOld);
      
      // Utiliser un format manuel pour afficher les données sans JSON.stringify sur des BigInt
      console.log("Paire trouvée avec les anciennes adresses:", {
        tokenA: pairDataOld?.tokenA,
        tokenB: pairDataOld?.tokenB,
        reserveA: pairDataOld?.reserveA ? pairDataOld.reserveA.toString() : "0",
        reserveB: pairDataOld?.reserveB ? pairDataOld.reserveB.toString() : "0"
      });
      
      if (pairDataOld && pairDataOld.reserveA && pairDataOld.reserveB) {
        const reserveAOld = pairDataOld.reserveA;
        const reserveBOld = pairDataOld.reserveB;
        console.log("Réserve A (old) brute:", reserveAOld.toString());
        console.log("Réserve B (old) brute:", reserveBOld.toString());
        
        return {
          tokenABalance: formatUnits(reserveAOld, 18),
          tokenBBalance: formatUnits(reserveBOld, 18)
        };
      }
    } catch (error) {
      console.log("Erreur avec les anciennes adresses:", error);
      console.log("Essai avec les adresses actuelles...");
    }
    
    // Tentative 2: Utiliser les adresses actuelles pour la paire
    try {
      console.log("Token A:", TOKENS.TOKEN_A);
      console.log("Token B:", TOKENS.TOKEN_B);
      
      const pairKey = getPairKey(TOKENS.TOKEN_A, TOKENS.TOKEN_B);
      console.log("Clé de paire (adresses actuelles):", pairKey);
      
      const pairData = await contract.pairs(pairKey);
      
      // Utiliser un format manuel pour afficher les données sans JSON.stringify sur des BigInt
      console.log("Paire trouvée avec les adresses actuelles:", {
        tokenA: pairData?.tokenA,
        tokenB: pairData?.tokenB,
        reserveA: pairData?.reserveA ? pairData.reserveA.toString() : "0",
        reserveB: pairData?.reserveB ? pairData.reserveB.toString() : "0"
      });
      
      if (pairData && pairData.reserveA && pairData.reserveB) {
        const reserveA = pairData.reserveA;
        const reserveB = pairData.reserveB;
        console.log("Réserve A brute:", reserveA.toString());
        console.log("Réserve B brute:", reserveB.toString());
        
        return {
          tokenABalance: formatUnits(reserveA, 18),
          tokenBBalance: formatUnits(reserveB, 18)
        };
      }
    } catch (error) {
      console.log("Erreur avec les adresses actuelles:", error);
    }

    // Tentative 3: Utiliser directement les balances ERC20 du contrat
    try {
      console.log("Tentative avec getTokenBalance sur le contrat DEX...");
      
      // Essayer d'abord avec les anciennes adresses
      const balanceAOld = await getTokenBalance(TOKENS.TOKEN_A_OLD, CONTRACT_ADDRESS);
      const balanceBOld = await getTokenBalance(TOKENS.TOKEN_B_OLD, CONTRACT_ADDRESS);
      
      if (balanceAOld !== "0" && balanceBOld !== "0") {
        console.log("Balances trouvées avec getTokenBalance (anciennes adresses):");
        console.log("Balance A:", balanceAOld);
        console.log("Balance B:", balanceBOld);
        return { tokenABalance: balanceAOld, tokenBBalance: balanceBOld };
      }
      
      // Sinon, essayer avec les adresses actuelles
      const balanceA = await getTokenBalance(TOKENS.TOKEN_A, CONTRACT_ADDRESS);
      const balanceB = await getTokenBalance(TOKENS.TOKEN_B, CONTRACT_ADDRESS);
      
      if (balanceA !== "0" && balanceB !== "0") {
        console.log("Balances trouvées avec getTokenBalance (adresses actuelles):");
        console.log("Balance A:", balanceA);
        console.log("Balance B:", balanceB);
        return { tokenABalance: balanceA, tokenBBalance: balanceB };
      }
    } catch (error) {
      console.log("Erreur avec getTokenBalance:", error);
    }
    
    console.error("Aucune méthode n'a permis de récupérer les balances du pool");
    return { tokenABalance: "0", tokenBBalance: "0" };
  } catch (error) {
    console.error("Erreur générale lors de la récupération des soldes du pool:", error);
    return { tokenABalance: "0", tokenBBalance: "0" };
  }
};

// Fonction pour vérifier le routeur Uniswap utilisé par le contrat
export const checkUniswapRouter = async (): Promise<string> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Récupérer l'adresse du routeur Uniswap
    const uniswapRouter = await contract.uniswapV2Router();
    console.log("Adresse du routeur Uniswap utilisé:", uniswapRouter);
    return uniswapRouter;
  } catch (error) {
    console.error("Erreur lors de la vérification du routeur Uniswap:", error);
    throw error;
  }
};

export const forwardToUniswap = async (
  tokenA: string,
  tokenB: string,
  amount: string
): Promise<void> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Vérifier le routeur Uniswap avant de continuer
    const uniswapRouter = await checkUniswapRouter();
    console.log("Routeur Uniswap vérifié:", uniswapRouter);
    
    console.log("Tentative de transfert vers Uniswap avec minAmountOut = 0");
    console.log("Token A:", tokenA);
    console.log("Token B:", tokenB);
    console.log("Montant:", amount);
    
    // Utiliser 0 comme minAmountOut pour éviter les erreurs de calcul
    // Cela signifie que l'utilisateur accepte n'importe quel taux d'échange (slippage maximal)
    // Ce n'est pas idéal en production mais permettra de tester si l'appel de base fonctionne
    const amountInWei = parseUnits(amount, 18);
    const tx = await contract.forwardToUniswap(tokenA, tokenB, amountInWei, 0);
    
    console.log("Transaction envoyée:", tx.hash);
    await tx.wait();
    console.log("Transaction confirmée");
  } catch (error) {
    console.error("Erreur lors du transfert vers Uniswap:", error);
    
    // Afficher plus de détails sur l'erreur pour aider au diagnostic
    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message);
      if ('data' in error) {
        console.error("Données d'erreur:", (error as any).data);
      }
      if ('transaction' in error) {
        console.error("Transaction qui a échoué:", (error as any).transaction);
      }
    }
    
    throw error;
  }
};

