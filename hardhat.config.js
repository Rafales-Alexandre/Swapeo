
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-toolbox");

const { vars } = require("hardhat/config");
const SEPOLIA_API_KEYS = vars.get("SEPOLIA_API_KEYS");
const PRIVATE_KEY = vars.get("PRIVATE_KEY");

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${SEPOLIA_API_KEYS}`,
      accounts: [PRIVATE_KEY],
    },
  },
};
