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
    // Utiliser getAmountOut qui est la fonction correcte dans l'ABI du contrat
    const amountInWei = parseUnits(amount, 18);
    const amountOutWei = await contract.getAmountOut(tokenA, tokenB, amountInWei);
    
    if (amountOutWei === 0n) {
      return "0";
    }
    
    const formattedAmount = formatUnits(amountOutWei, 18);
    
    // Le taux de conversion est le montant de sortie divisé par le montant d'entrée
    const rate = Number(formattedAmount) / Number(amount);
    
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
): Promise<{ hash: string, inputAmount: string, outputAmount?: string }> => {
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
    const estimatedOutput = formatUnits(amountsOut[1], 18);
    console.log(`Montant d'entrée: ${amount} ${tokenA}`);
    console.log(`Montant de sortie estimé: ${estimatedOutput} ${tokenB}`);
    
    // Définir une deadline de 20 minutes
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
    
    // Approuver d'abord le routeur Uniswap pour utiliser nos tokens
    await approveToken(tokenA, amount, routerAddress);
    
    // Exécuter le swap
    console.log("Exécution du swap via le routeur Uniswap directement");
    console.log("Montant d'entrée:", amountInWei.toString());
    console.log("Montant de sortie minimum:", minAmountOut.toString());
    
    // Appeler la fonction de swap
    const tx = await uniswapRouter.swapExactTokensForTokens(
      amountInWei,
      minAmountOut,
      path,
      await signer.getAddress(), // Destinataire des tokens
      deadline
    );
    
    const receipt = await tx.wait();
    console.log("Swap via Uniswap réussi, transaction hash:", receipt.hash);
    
    // On peut aussi essayer de récupérer le montant exact à partir des logs de transactions
    // Mais pour l'instant, utilisons l'estimation qui est déjà précise
    
    return {
      hash: receipt.hash,
      inputAmount: amount,
      outputAmount: estimatedOutput
    };
    
  } catch (error) {
    console.error("Erreur lors du swap via le routeur Uniswap:", error);
    throw error;
  }
};

// Fonction pour approuver un token pour un spender spécifique
export const approveToken = async (
  tokenAddress: string, 
  amount: string, 
  spenderAddress: string = CONTRACT_ADDRESS
): Promise<boolean> => {
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
    
    // Vérifier que l'approbation a bien été prise en compte
    return newAllowance >= amountInWei;

  } catch (error) {
    console.error("Error in approveToken:", error);
    return false;
  }
};

export const swapTokens = async (
  tokenA: string,
  tokenB: string,
  amount: string
): Promise<{success: boolean, uniswapFallback: boolean, directUniswap: boolean, error?: string, txHash?: string, inputAmount?: string, outputAmount?: string}> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Obtenir une estimation du montant de sortie basée sur le taux d'échange actuel
    let estimatedOutput;
    try {
      const rate = await getConversionRate(tokenA, tokenB, amount);
      const inputValue = parseFloat(amount);
      const rateValue = parseFloat(rate);
      estimatedOutput = (inputValue * rateValue).toString();
      console.log(`Taux d'échange estimé: 1 ${tokenA} = ${rate} ${tokenB}`);
      console.log(`Estimation du montant de sortie: ${estimatedOutput} ${tokenB}`);
    } catch (rateError) {
      console.warn("Impossible d'obtenir le taux d'échange:", rateError);
      estimatedOutput = amount; // Fallback au ratio 1:1 si le taux n'est pas disponible
    }
    
    // Essayer d'abord avec la méthode swap
    const tx = await contract.swap(tokenA, tokenB, parseUnits(amount, 18));
    const receipt = await tx.wait();
    
    // Chercher un événement qui pourrait contenir les montants réels (si votre contrat émet un tel événement)
    // Si pas d'événement, utiliser l'estimation
    let actualOutput = estimatedOutput;
    // Code pour extraire les montants réels des événements, si disponible
    
    return { 
      success: true, 
      uniswapFallback: false, 
      directUniswap: false,
      txHash: receipt.hash,
      inputAmount: amount,
      outputAmount: actualOutput
    };
  } catch (error: any) {
    // Vérifier si l'erreur est spécifique au manque de liquidité
    if (error.message && (
      error.message.includes("Paire inexistante ou sans liquidite") ||
      error.message.includes("utilisez forwardToUniswap")
    )) {
      console.log("Paire sans liquidité, tentative de transfert vers Uniswap...");
      
      // Obtenir une estimation du montant de sortie via Uniswap
      let uniswapEstimatedOutput;
      try {
        // Tenter d'obtenir une estimation plus précise via Uniswap
        // Cela pourrait être fait via le routeur Uniswap directement
        const rate = await getConversionRate(tokenA, tokenB, amount);
        uniswapEstimatedOutput = (parseFloat(amount) * parseFloat(rate)).toString();
      } catch (rateError) {
        console.warn("Impossible d'obtenir le taux d'échange via Uniswap:", rateError);
        uniswapEstimatedOutput = amount;
      }
      
      try {
        // Utiliser forwardToUniswap comme première solution de secours
        const result = await forwardToUniswap(tokenA, tokenB, amount);
        return { 
          success: true, 
          uniswapFallback: true, 
          directUniswap: false,
          txHash: result.hash,
          inputAmount: result.inputAmount,
          outputAmount: result.outputAmount || uniswapEstimatedOutput
        };
      } catch (uniswapError: any) {
        console.error("Erreur lors du transfert vers Uniswap via le contrat:", uniswapError);
        
        try {
          // Dernière tentative : utiliser directement le routeur Uniswap
          console.log("Tentative d'échange direct via le routeur Uniswap...");
          const result = await swapWithUniswapRouter(tokenA, tokenB, amount);
          return { 
            success: true, 
            uniswapFallback: false, 
            directUniswap: true,
            txHash: result.hash,
            inputAmount: result.inputAmount,
            outputAmount: result.outputAmount || uniswapEstimatedOutput
          };
        } catch (directUniswapError: any) {
          console.error("Échec de toutes les méthodes d'échange:", directUniswapError);
          return { 
            success: false, 
            uniswapFallback: false, 
            directUniswap: false,
            error: directUniswapError.message,
            txHash: undefined,
            inputAmount: undefined,
            outputAmount: undefined
          };
        }
      }
    }
    
    // Pour d'autres types d'erreurs
    console.error("Erreur lors du swap:", error);
    return { 
      success: false, 
      uniswapFallback: false, 
      directUniswap: false,
      error: error.message,
      txHash: undefined,
      inputAmount: undefined,
      outputAmount: undefined
    };
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
  if (!contract) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  // Vérifier que le montant est strictement supérieur à zéro
  if (!amountA || Number(amountA) <= 0) {
    throw new Error("Le montant à retirer doit être supérieur à zéro");
  }
  
  try {
    // Vérifier les balances LP avant de tenter le retrait
    const account = await requestAccount();
    if (!account) {
      throw new Error("Aucun compte connecté");
    }
    
    // Récupérer les balances LP actuelles
    const userLPBalanceA = await contract.lpBalances(tokenA, account);
    
    // Convertir le montant demandé en BigInt
    const amountABigInt = parseUnits(amountA, 18);
    
    // Vérifier que l'utilisateur a suffisamment de jetons LP pour le token A
    if (userLPBalanceA < amountABigInt) {
      throw new Error(`Solde LP insuffisant pour ${tokenA}. Demandé: ${amountA}, Disponible: ${formatUnits(userLPBalanceA, 18)}`);
    }
    
    // Dans ce contrat, les balances LP ne sont pas proportionnelles aux réserves du pool
    // Nous n'avons donc pas besoin de vérifier la balance LP de tokenB par rapport au ratio
    // Nous faisons confiance au contrat pour gérer correctement le retrait
    
    // Procéder au retrait
    const tx = await contract.withdraw(tokenA, tokenB, amountABigInt);
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
  lpBalanceA: string;
  lpBalanceB: string;
}> => {
  try {
    if (!contract) {
      await initialize();
    }

    // Utiliser les anciennes adresses qui semblent mieux fonctionner avec le contrat
    const tokenA = TOKENS.TOKEN_A_OLD;
    const tokenB = TOKENS.TOKEN_B_OLD;

    // Récupérer la clé de la paire
    const pairKey = await contract?.pairKeys(tokenA, tokenB);

    if (!pairKey || pairKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      return {
        tokenAAmount: "0",
        tokenBAmount: "0",
        poolShare: "0",
        lpBalanceA: "0",
        lpBalanceB: "0"
      };
    }

    // Récupérer les données de la paire
    const pair = await contract?.pairs(pairKey);
    
    // Récupérer les balances LP de l'utilisateur
    const userLPBalanceA = await contract?.lpBalances(tokenA, account);
    const userLPBalanceB = await contract?.lpBalances(tokenB, account);
    
    // Formater les balances LP pour l'affichage
    const lpBalanceAFormatted = formatUnits(userLPBalanceA || 0n, 18);
    const lpBalanceBFormatted = formatUnits(userLPBalanceB || 0n, 18);
    
    // Si l'utilisateur n'a pas de liquidité, retourner 0 pour éviter des calculs inutiles
    if ((userLPBalanceA === 0n || !userLPBalanceA) && (userLPBalanceB === 0n || !userLPBalanceB)) {
      return {
        tokenAAmount: "0",
        tokenBAmount: "0", 
        poolShare: "0",
        lpBalanceA: lpBalanceAFormatted,
        lpBalanceB: lpBalanceBFormatted
      };
    }
    
    // Récupérer les réserves totales
    const reserveA = pair?.reserveA || 0n;
    const reserveB = pair?.reserveB || 0n;
    
    // Récupérer les listes de fournisseurs de liquidité
    const lpListA = await contract?.getLPList(tokenA);
    const lpListB = await contract?.getLPList(tokenB);
    
    // Calculer le total des balances LP pour chaque token
    let totalLPBalanceA = 0n;
    let totalLPBalanceB = 0n;
    
    for (const lp of lpListA) {
      const balance = await contract!.lpBalances(tokenA, lp);
      totalLPBalanceA += balance;
    }
    
    for (const lp of lpListB) {
      const balance = await contract!.lpBalances(tokenB, lp);
      totalLPBalanceB += balance;
    }
    
    // Calculer la part de la pool en pourcentage pour chaque token
    let poolShareA = "0";
    let poolShareB = "0";
    
    if (totalLPBalanceA > 0n && userLPBalanceA > 0n) {
      const shareA = (userLPBalanceA * 10000n) / totalLPBalanceA;
      poolShareA = (Number(shareA) / 100).toString();
    }
    
    if (totalLPBalanceB > 0n && userLPBalanceB > 0n) {
      const shareB = (userLPBalanceB * 10000n) / totalLPBalanceB;
      poolShareB = (Number(shareB) / 100).toString();
    }
    
    // Utiliser la moyenne des deux parts
    const poolShare = ((Number(poolShareA) + Number(poolShareB)) / 2).toString();
    
    // Calculer la valeur des tokens correspondant à la part de l'utilisateur
    // Dans ce contrat, les balances LP sont directement les montants de tokens
    const userTokenAAmount = userLPBalanceA || 0n;
    const userTokenBAmount = userLPBalanceB || 0n;

    // Formater les résultats finaux
    const formattedResult = {
      tokenAAmount: formatUnits(userTokenAAmount, 18),
      tokenBAmount: formatUnits(userTokenBAmount, 18),
      poolShare,
      lpBalanceA: lpBalanceAFormatted,
      lpBalanceB: lpBalanceBFormatted
    };

    return formattedResult;

  } catch (error) {
    console.error("Erreur dans getLiquidityPosition:", error);
    return {
      tokenAAmount: "0",
      tokenBAmount: "0",
      poolShare: "0",
      lpBalanceA: "0",
      lpBalanceB: "0"
    };
  }
};

export const getTokenBalance = async (tokenAddress: string, account: string): Promise<string> => {
  try {
    if (!isInitialized) {
      await initialize();
    }

    // Vérifier que l'adresse du compte est valide
    if (!account) {
      return "0";
    }

    // Vérifier que l'adresse du token est valide
    if (!tokenAddress) {
      return "0";
    }

    // Créer une instance du contrat ERC20 avec un ABI minimal
    const tokenABI = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function name() view returns (string)"
    ];
    
    try {
      // Utilisons provider au lieu de signer pour les appels en lecture seule
      const tokenContract = new Contract(tokenAddress, tokenABI, provider);
      
      // Récupérer les informations du token
      let symbol = "Unknown";
      let name = "Unknown";
      let decimals = 18;
      
      try {
        symbol = await tokenContract.symbol();
      } catch (e) {
        console.error("Erreur lors de la récupération du symbole:", e);
      }
      
      try {
        name = await tokenContract.name();
      } catch (e) {
        console.error("Erreur lors de la récupération du nom:", e);
      }
      
      try {
        decimals = await tokenContract.decimals();
      } catch (e) {
        console.error("Erreur lors de la récupération des décimales, utilisation de la valeur par défaut (18):", e);
      }
      
      // Récupérer la balance avec un try/catch spécifique
      try {
        const balance = await tokenContract.balanceOf(account);
        
        // Formater la balance avec le bon nombre de décimales
        const formattedBalance = formatUnits(balance, decimals);
        
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
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }

  // Essayons d'abord avec les anciennes adresses puisque ce sont celles qui fonctionnent pour le taux d'échange
  try {
    // Tentative 1: Utiliser les anciennes adresses pour la paire
    const pairKeyOld = getPairKey(TOKENS.TOKEN_A_OLD, TOKENS.TOKEN_B_OLD);
    
    const pairDataOld = await contract.pairs(pairKeyOld);
    
    if (pairDataOld && pairDataOld.reserveA && pairDataOld.reserveB) {
      const reserveAOld = pairDataOld.reserveA;
      const reserveBOld = pairDataOld.reserveB;
      
      return {
        tokenABalance: formatUnits(reserveAOld, 18),
        tokenBBalance: formatUnits(reserveBOld, 18)
      };
    }
  } catch (error) {
    // Silencieux, on essaie avec les adresses actuelles
  }
  
  // Tentative 2: Utiliser les adresses actuelles pour la paire
  try {
    const pairKey = getPairKey(TOKENS.TOKEN_A, TOKENS.TOKEN_B);
    
    const pairData = await contract.pairs(pairKey);
    
    if (pairData && pairData.reserveA && pairData.reserveB) {
      const reserveA = pairData.reserveA;
      const reserveB = pairData.reserveB;
      
      return {
        tokenABalance: formatUnits(reserveA, 18),
        tokenBBalance: formatUnits(reserveB, 18)
      };
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des balances du pool:", error);
  }
  
  // Si aucune des tentatives n'a fonctionné, retourner des valeurs par défaut
  return {
    tokenABalance: "0",
    tokenBBalance: "0"
  };
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
): Promise<{ hash: string, inputAmount: string, outputAmount?: string }> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Convertir le montant en wei (18 décimales)
    const amountInWei = parseUnits(amount, 18);
    
    // Appeler la fonction forwardToUniswap du contrat
    console.log(`Appel de forwardToUniswap avec tokenA=${tokenA}, tokenB=${tokenB}, amount=${amountInWei.toString()}`);
    const tx = await contract.forwardToUniswap(tokenA, tokenB, amountInWei);
    
    // Attendre que la transaction soit confirmée
    console.log("En attente de confirmation pour forwardToUniswap...");
    const receipt = await tx.wait();
    
    console.log("Transaction forwardToUniswap confirmée, hash:", receipt.hash);
    
    return {
      hash: receipt.hash,
      inputAmount: amount,
      outputAmount: undefined // Nous ne connaissons pas le montant exact sans événement
    };
  } catch (error) {
    console.error("Erreur lors de l'appel à forwardToUniswap:", error);
    throw error;
  }
};

// Fonction pour récupérer l'instance du contrat
export const getContract = (): Contract | undefined => {
  if (!isInitialized) {
    console.warn("Le contrat n'est pas initialisé. Appelez initialize() d'abord.");
  }
  return contract;
};

// Fonction de diagnostic pour récupérer les valeurs exactes du contrat
export const getContractDiagnostics = async (account: string): Promise<{
  pairInfo: any;
  userLPBalances: any;
  reserveValues: any;
  contractAddress: string;
}> => {
  if (!contract) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    // Récupérer l'adresse du contrat
    const contractAddress = CONTRACT_ADDRESS;
    
    // Récupérer les adresses des tokens
    const tokenA = TOKENS.TOKEN_A_OLD;
    const tokenB = TOKENS.TOKEN_B_OLD;
    
    // Récupérer la clé de la paire
    const pairKey = await contract.pairKeys(tokenA, tokenB);
    
    // Récupérer les données de la paire
    const pair = await contract.pairs(pairKey);
    
    // Récupérer les balances LP de l'utilisateur
    const userLPBalanceA = await contract.lpBalances(tokenA, account);
    const userLPBalanceB = await contract.lpBalances(tokenB, account);
    
    // Récupérer les réserves totales
    const reserveA = pair.reserveA;
    const reserveB = pair.reserveB;
    
    // Récupérer les listes de fournisseurs de liquidité
    const lpListA = await contract.getLPList(tokenA);
    const lpListB = await contract.getLPList(tokenB);
    
    // Calculer le total des balances LP pour chaque token
    let totalLPBalanceA = 0n;
    let totalLPBalanceB = 0n;
    
    for (const lp of lpListA) {
      const balance = await contract.lpBalances(tokenA, lp);
      totalLPBalanceA += balance;
    }
    
    for (const lp of lpListB) {
      const balance = await contract.lpBalances(tokenB, lp);
      totalLPBalanceB += balance;
    }
    
    // Formater les informations pour l'affichage
    const pairInfo = {
      pairKey,
      tokenA: pair.tokenA,
      tokenB: pair.tokenB,
      reserveA: formatUnits(reserveA, 18),
      reserveB: formatUnits(reserveB, 18)
    };
    
    const userLPBalances = {
      tokenA: {
        address: tokenA,
        balance: formatUnits(userLPBalanceA, 18)
      },
      tokenB: {
        address: tokenB,
        balance: formatUnits(userLPBalanceB, 18)
      }
    };
    
    const reserveValues = {
      totalLPBalanceA: formatUnits(totalLPBalanceA, 18),
      totalLPBalanceB: formatUnits(totalLPBalanceB, 18)
    };
    
    return {
      pairInfo,
      userLPBalances,
      reserveValues,
      contractAddress
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des diagnostics du contrat:", error);
    throw error;
  }
};

