export const requestAccount = async (): Promise<string | null> => {
  try {
    if (!window.ethereum) {
      throw new Error("MetaMask n'est pas installé. Veuillez l'installer et réessayer.");
    }

    // Vérifier si nous sommes déjà connectés
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      console.log("Compte déjà connecté:", accounts[0]);
      return accounts[0];
    }

    // Si pas encore initialisé, initialiser
    if (!isInitialized) {
      try {
        await initialize();
      } catch (error) {
        console.error("Erreur d'initialisation:", error);
        throw new Error("Impossible de se connecter au réseau local. Vérifiez que votre nœud Hardhat est en cours d'exécution.");
      }
    }

    try {
      console.log("Demande de connexion du compte...");
      const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (newAccounts && newAccounts.length > 0) {
        console.log("Compte connecté:", newAccounts[0]);
        return newAccounts[0];
      } else {
        throw new Error("Aucun compte n'a été sélectionné");
      }
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error("Vous avez refusé la connexion à MetaMask");
      }
      throw error;
    }
  } catch (error) {
    console.error("Erreur lors de la demande de compte:", error);
    throw error;
  }
}; 