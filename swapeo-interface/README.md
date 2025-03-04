# Swapeo Interface

Interface utilisateur pour le protocole SwapeoDEX, un exchange décentralisé avec intégration Uniswap V2.

## Fonctionnalités Principales

### 1. Gestion du Compte
- **Connexion du Wallet** :
  - Connexion via MetaMask ou WalletConnect
  - Affichage de l'adresse du compte connecté
  - Déconnexion sécurisée
  - État de connexion persistant

### 2. Interface de Swap
- **Sélection des Tokens** :
  - Liste des tokens disponibles
  - Recherche et filtrage
  - Affichage des balances

- **Swap de Tokens** :
  - Input du montant à échanger
  - Calcul automatique du montant reçu
  - Affichage du taux de change
  - Estimation des frais de gas
  - Impact sur le prix
  - Protection contre le slippage

### 3. Gestion de la Liquidité
- **Ajout de Liquidité** :
  - Sélection de paires de tokens
  - Calcul automatique des ratios
  - Approbation des tokens
  - Visualisation de la part du pool

- **Retrait de Liquidité** :
  - Retrait partiel ou total
  - Calcul des montants reçus
  - Affichage des fees collectés
  - Rafraîchissement automatique (30s)

### 4. Suivi des Transactions
- **États des Transactions** :
  - Notifications en temps réel
  - États de chargement
  - Messages d'erreur détaillés
  - Confirmations de transaction

## Fonctionnalités Supplémentaires

### Interface Utilisateur Avancée
- **Thème Personnalisable** :
  - Mode clair/sombre
  - Transitions fluides
  - Design responsive

- **Composants Interactifs** :
  - Animations de chargement
  - Retours visuels
  - Tooltips d'aide

### Sécurité et Validation
- **Validation des Entrées** :
  - Vérification des montants
  - Validation des paires de tokens
  - Prévention des erreurs utilisateur

- **Gestion des Erreurs** :
  - Messages d'erreur contextuels
  - Suggestions de correction
  - Récupération gracieuse

### Statistiques et Métriques
- **Informations en Temps Réel** :
  - Prix des tokens
  - Liquidité des pools
  - Parts de pool
  - Fees accumulés

- **Historique** :
  - Transactions passées
  - Performance des pools
  - Gains en fees

## Stack Technique
- React avec TypeScript
- Web3.js pour les interactions blockchain
- Ethers.js pour la gestion des transactions
- React-Toastify pour les notifications
- CSS Modules pour le styling

## Installation

```bash
# Installation des dépendances
npm install

# Lancement en développement
npm run dev

# Build pour la production
npm run build
```

## Configuration
- Créer un fichier `.env` basé sur `.env.example`
- Configurer les adresses des contrats et les endpoints RPC

## Tests
```bash
# Lancement des tests
npm run test
```
