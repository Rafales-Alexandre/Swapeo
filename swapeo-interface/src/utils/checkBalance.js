import { ethers } from 'ethers';

async function checkBalance() {
  try {
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const accounts = await provider.listAccounts();
    for (let account of accounts) {
      const balance = await provider.getBalance(account);
      console.log(`Compte ${account}: ${ethers.formatEther(balance)} ETH`);
    }
  } catch (error) {
    console.error('Erreur:', error);
  }
}

checkBalance(); 