# SwapeoDEX

Un protocole de Decentralized Exchange (DEX) avec intégration Uniswap V2.

## Fonctionnalités Principales

### 1. Gestion des Liquidity Providers
- **Dépôt de Liquidité** : 
  - Fonction `deposit(tokenA, tokenB, amountA, amountB)`
  - Permet aux LPs de déposer des paires de tokens
  - Tracking précis des contributions via `lpBalances`

- **Retrait de Liquidité** :
  - Fonction `withdraw(tokenA, tokenB, amountARequested)`
  - Calcul proportionnel des montants de retrait
  - Vérifications de sécurité pour empêcher les retraits non autorisés

- **Collection des Frais** :
  - Fonction `distributeFees(token)`
  - Distribution proportionnelle des frais aux LPs
  - Frais de trading de 1% sur chaque swap

### 2. Système de Trading
- **Swap de Tokens** :
  - Fonction `swap(inputToken, outputToken, amountIn)`
  - Calcul automatique des taux via formule AMM
  - Vérifications des réserves pour des échanges cohérents
  - Prélèvement de 1% de frais sur chaque transaction

### 3. Intégration Uniswap V2
- **Forwarding des Swaps** :
  - Fonction `forwardToUniswap(inputToken, outputToken, amount, minAmountOut)`
  - Redirection automatique si pas de liquidité disponible
  - Frais additionnels de 0.5% pour le créateur
  - Protection contre le slippage avec `minAmountOut`

## Mesures de Sécurité

### Protections Implémentées
1. **Contre les Retraits Non Autorisés** :
   - Vérification des balances des LPs
   - Tracking précis des contributions
   - Calculs proportionnels pour les retraits

2. **Contre les Swaps Incohérents** :
   - Vérification des réserves disponibles
   - Calculs AMM pour des taux équitables
   - Protection contre les manipulations de prix

### Sécurité Technique
- Utilisation de `ReentrancyGuard`
- Héritages de `Ownable` pour la gestion des droits
- Smart contract en Solidity 0.8.24 (protection contre les overflows)
- Utilisation des contrats OpenZeppelin audités

## Stack Technique
- Hardhat
- TypeScript
- OpenZeppelin Contracts
- Uniswap V2 Integration

## Tests

Les tests sont implémentés dans `test/Swapeo.ts` et couvrent l'ensemble des fonctionnalités du protocole :

### Tests de Base
- **Déploiement** :
  - Configuration du router Uniswap
  - Vérification du owner

- **Gestion des Liquidités** :
  - Dépôt de tokens dans une paire
  - Retrait de liquidité
  - Vérification des balances LP
  - Gestion de la liste des LPs

### Tests Fonctionnels
- **Swaps** :
  - Échanges via AMM
  - Calcul correct des montants
  - Prélèvement des frais (1%)
  - Redirection vers Uniswap

- **Distribution des Frais** :
  - Distribution proportionnelle aux LPs
  - Réinitialisation après distribution
  - Vérification des parts (ex: ratio 2:1)

### Tests de Scénarios Complexes
- **Opérations Multiples** :
  - Séquence de dépôts/retraits/swaps
  - Vérification des invariants :
    * Réserves non nulles
    * Somme des balances LP
    * Produit constant
    * Cohérence des parts

- **Cas Extrêmes** :
  - Différences de prix importantes (1:1000)
  - Petits montants de swap
  - Précision décimale

### Tests de Sécurité
- **Protection contre** :
  - Manipulation des prix
  - Retraits non autorisés
  - Tokens invalides
  - Montants nuls

### Exécution des Tests
```bash
npx hardhat test
```

Les tests utilisent :
- Hardhat pour l'environnement
- Chai pour les assertions
- ethers.js pour les interactions
- Mocks pour Uniswap et ERC20

Résultats attendus : 26 tests passant en ~1 seconde.

Des contrats de mock sont fournis pour les tests :
- `MockUniswapRouter.sol` : Simulation d'Uniswap V2
- `ERC20Mock.sol` : Tokens ERC20 pour les tests
