require("@nomiclabs/hardhat-ethers");

module.exports = {
  networks: {
    sepolia: {
      url: "https://sepolia.infura.io/v3/89469d23652842f68787a804d8f012ce",
      accounts: ["0x5578e1c3dfce56416437a60a0730f05daba96caa3a2171b9291fa2d61163c14d"]
    }
  }
};
