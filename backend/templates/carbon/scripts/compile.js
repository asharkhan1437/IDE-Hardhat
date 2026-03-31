const path = require("path");
const fs = require("fs");
const solc = require("solc");

// Read contract file
const contractPath = path.resolve(__dirname, "../contracts/CarbonToken.sol");
const source = fs.readFileSync(contractPath, "utf8");

// Import resolver
function findImports(importPath) {
  try {
    const fullPath = path.resolve(__dirname, "../node_modules", importPath);
    const content = fs.readFileSync(fullPath, "utf8");
    return { contents: content };
  } catch (error) {
    return { error: "File not found" };
  }
}

const input = {
  language: "Solidity",
  sources: {
    "CarbonToken.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"]
      }
    }
  },
};

const output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImports })
);

// Show compiler errors clearly
if (output.errors) {
  output.errors.forEach(err => console.log(err.formattedMessage));
}

const contract = output.contracts["CarbonToken.sol"]["CarbonToken"];

fs.writeFileSync("CarbonTokenABI.json", JSON.stringify(contract.abi, null, 2));
fs.writeFileSync("CarbonTokenBytecode.txt", contract.evm.bytecode.object);

console.log("Compiled successfully.");
