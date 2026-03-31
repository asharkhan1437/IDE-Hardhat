const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    "https://sepolia.infura.io/v3/89469d23652842f68787a804d8f012ce"
  );

  const wallet = new ethers.Wallet("0x5578e1c3dfce56416437a60a0730f05daba96caa3a2171b9291fa2d61163c14d", provider);

  const abi = JSON.parse(fs.readFileSync("CarbonTokenABI.json"));
  const bytecode = fs.readFileSync("CarbonTokenBytecode.txt").toString();

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  console.log("Deploying contract...");

  const contract = await factory.deploy(100);
  await contract.deployed();

  console.log("Contract deployed at:", contract.address);
}

main();
