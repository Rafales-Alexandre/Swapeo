# Swapeo - Plateforme DEX (Decentralized Exchange)

Swapeo est une plateforme d'échange décentralisée (DEX) complète qui permet aux utilisateurs d'échanger des tokens et de fournir de la liquidité sur la blockchain. Le projet est composé de trois parties principales : les smart contracts, le backend, et l'interface utilisateur.

## 🏗️ Architecture du Projet

Le projet est divisé en trois composants principaux :

### 📁 contract/
Contient les smart contracts Solidity et la configuration Hardhat
- Smart contracts pour l'échange de tokens
- Tests unitaires
- Scripts de déploiement
- Configuration Hardhat

### 📁 swapeo-backend/
API backend pour supporter les fonctionnalités avancées
- Gestion des transactions
- Interaction avec les smart contracts
- API REST pour l'interface utilisateur

### 📁 swapeo-interface/
Interface utilisateur React moderne et responsive
- Connection au wallet
- Interface d'échange de tokens
- Gestion de la liquidité
- Visualisation des statistiques

## 🚀 Installation

1. Cloner le dépôt :
```bash
git clone [URL_DU_REPO]
```

2. Installer les dépendances pour chaque composant :

Pour les smart contracts :
```bash
cd contract
npm install
```

Pour le backend :
```bash
cd swapeo-backend
npm install
```

Pour l'interface :
```bash
cd swapeo-interface
npm install
```

## 🔧 Configuration

1. Smart Contracts :
- Créer un fichier `.env` dans le dossier `contract/` avec :
```
PRIVATE_KEY=votre_clé_privée
INFURA_API_KEY=votre_clé_infura
```

2. Backend :
- Créer un fichier `.env` dans le dossier `swapeo-backend/` avec :
```
PORT=3000
CONTRACT_ADDRESS=adresse_du_contrat_déployé
```

3. Interface :
- Créer un fichier `.env` dans le dossier `swapeo-interface/` avec :
```
VITE_CONTRACT_ADDRESS=adresse_du_contrat_déployé
VITE_BACKEND_URL=http://localhost:3000
```

## 🏃‍♂️ Démarrage

1. Déployer les smart contracts :
```bash
cd contract
npx hardhat run scripts/deploy.js --network [RÉSEAU]
```

2. Démarrer le backend :
```bash
cd swapeo-backend
npm run dev
```

3. Démarrer l'interface :
```bash
cd swapeo-interface
npm run dev
```

## 🧪 Tests

Pour exécuter les tests des smart contracts :
```bash
cd contract
npx hardhat test
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails. 