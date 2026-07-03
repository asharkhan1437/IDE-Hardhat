/**
 * register-contracts.cjs
 * 
 * Uploads every compiled contract artifact from artifacts/ to IPFS via Pinata.
 * Each contract gets its own unique CID — the hash changes if the contract code changes.
 * This creates an immutable on-chain record that THIS exact contract version was registered.
 *
 * Setup:
 *   export PINATA_JWT=eyJ...   (from app.pinata.cloud → API Keys → New Key)
 *
 * Usage:
 *   node register-contracts.cjs
 */

const fs = require("fs");
const path = require("path");

const PINATA_JWT = process.env.PINATA_JWT;
const ARTIFACTS_DIR = "./artifacts";

if (!PINATA_JWT) {
  console.error("\x1b[1;31mError: PINATA_JWT not set.\x1b[0m");
  console.error("Get a free key at https://app.pinata.cloud → API Keys → New Key");
  console.error("Then: export PINATA_JWT=your_jwt_here");
  process.exit(1);
}

if (!fs.existsSync(ARTIFACTS_DIR)) {
  console.error("\x1b[1;31mNo artifacts/ folder found. Click ⚒ Compile first.\x1b[0m");
  process.exit(1);
}

const artifactFiles = fs.readdirSync(ARTIFACTS_DIR)
  .filter(f => f.endsWith(".json") && !f.startsWith("_"));

if (!artifactFiles.length) {
  console.error("\x1b[1;31mNo compiled artifacts found. Click ⚒ Compile first.\x1b[0m");
  process.exit(1);
}

async function uploadToIPFS(contractName, artifact) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: {
        contractName: artifact.contractName,
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        deployedBytecode: artifact.deployedBytecode,
        compiledAt: new Date().toISOString(),
        sourceFile: contractName,
      },
      pinataMetadata: {
        name: `Zicon-${contractName}-${Date.now()}`,
        keyvalues: {
          project: "Zicon",
          contract: contractName,
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.IpfsHash;
}

async function main() {
  console.log("\x1b[1;36m╔══════════════════════════════════════════╗\x1b[0m");
  console.log("\x1b[1;36m║   Uploading Contract Artifacts to IPFS   ║\x1b[0m");
  console.log("\x1b[1;36m╚══════════════════════════════════════════╝\x1b[0m\n");

  const results = [];

  for (const file of artifactFiles) {
    const contractName = file.replace(".json", "");
    const artifact = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, file), "utf-8"));

    if (!artifact.abi || !artifact.bytecode) {
      console.log(`\x1b[33m⚠ Skipping ${file} (no ABI/bytecode)\x1b[0m`);
      continue;
    }

    process.stdout.write(`Uploading ${contractName}... `);
    try {
      const cid = await uploadToIPFS(contractName, artifact);
      console.log(`\x1b[32m✓\x1b[0m`);
      console.log(`  CID:     ${cid}`);
      console.log(`  IPFS:    ipfs://${cid}`);
      console.log(`  Gateway: https://gateway.pinata.cloud/ipfs/${cid}\n`);
      results.push({ contract: contractName, cid });

      // Save CID back into the artifact file for reference
      artifact.ipfsCID = cid;
      fs.writeFileSync(path.join(ARTIFACTS_DIR, file), JSON.stringify(artifact, null, 2));
    } catch (err) {
      console.log(`\x1b[31m✗ ${err.message}\x1b[0m`);
    }
  }

  if (!results.length) {
    console.error("\x1b[1;31mNo contracts were uploaded.\x1b[0m");
    process.exit(1);
  }

  // Save a registry summary file
  const summary = {
    uploadedAt: new Date().toISOString(),
    contracts: results,
  };
  fs.writeFileSync("ipfs-registry.json", JSON.stringify(summary, null, 2));

  console.log("\x1b[1;32m══════════════════════════════════════════\x1b[0m");
  console.log("\x1b[1;32m✅ Done! Saved to ipfs-registry.json\x1b[0m");
  console.log("\x1b[1;32m══════════════════════════════════════════\x1b[0m\n");
  console.log("Next step — register each CID on-chain:");
  results.forEach(r => {
    console.log(`  registerCredit("${r.cid}", <tonnesCO2>)  // ${r.contract}`);
  });
}

main().catch(e => {
  console.error("\x1b[1;31mFatal: " + e.message + "\x1b[0m");
  process.exit(1);
});
