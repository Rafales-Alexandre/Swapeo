# Swapeo Backend

Backend pour le protocole Swapeo, fournissant des API pour accéder aux données du protocole de DeFi.

## Configuration

1. Installer les dépendances :
```bash
npm install
```

2. Configurer les variables d'environnement dans le fichier `.env` :
```env
PORT=3001
PROVIDER_URL=http://localhost:8545
CONTRACT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

3. Lancer le serveur en mode développement :
```bash
npm run dev
```

## API Endpoints

### Tokens Disponibles
```http
GET /api/tokens
```

Retourne la liste des tokens disponibles dans le protocole.

#### Réponse
```json
[
  {
    "address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "symbol": "TOKEN1",
    "name": "Token One"
  },
  {
    "address": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    "symbol": "TOKEN2",
    "name": "Token Two"
  }
]
```

### Nombre de Swaps
```http
GET /api/swaps/count
```

Retourne le nombre total de swaps effectués sur le protocole.

#### Réponse
```json
{
  "count": 5
}
```

### Liste des Utilisateurs
```http
GET /api/users
```

Retourne la liste des utilisateurs qui ont interagi avec le protocole.

#### Réponse
```json
[
  {
    "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "swapCount": 3
  },
  {
    "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "swapCount": 2
  }
]
```

### Fournisseurs de Liquidité
```http
GET /api/liquidity-providers
```

Retourne la liste des fournisseurs de liquidité et leur contribution totale.

#### Réponse
```json
[
  {
    "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "totalLiquidity": "1000000000000000000"
  }
]
```

## Structure du Projet

```
swapeo-backend/
├── src/
│   ├── controllers/     # Contrôleurs pour la gestion des requêtes
│   ├── services/        # Services pour la logique métier
│   ├── routes/          # Définition des routes
│   ├── utils/          # Utilitaires et configurations
│   └── app.ts          # Point d'entrée de l'application
├── .env                # Variables d'environnement
└── tsconfig.json       # Configuration TypeScript
```

## Scripts Disponibles

- `npm run dev` : Lance le serveur en mode développement avec hot-reload
- `npm run build` : Compile le projet TypeScript
- `npm start` : Lance le serveur en production
- `npm run watch` : Lance le compilateur TypeScript en mode watch

## Technologies Utilisées

- Node.js
- Express.js
- TypeScript
- ethers.js
- dotenv
- cors

## Sécurité

- Validation des entrées
- Gestion des erreurs
- CORS configuré
- Variables d'environnement pour les données sensibles

## Contribution

1. Forker le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request 