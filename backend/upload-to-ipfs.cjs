/**
 * upload-to-ipfs.cjs — uploads carbon credit metadata to IPFS via Pinata's free tier.
 *
 * Setup (one-time):
 *   1. Sign up free at https://app.pinata.cloud (no card needed)
 *   2. Go to API Keys → New Key → enable "pinFileToIPFS" + "pinJSONToIPFS" → copy the JWT
 *   3. export PINATA_JWT=your_jwt_here
 *
 * Usage:
 *   node upload-to-ipfs.cjs metadata.json
 *
 * Prints the IPFS CID — pass this directly into registerCredit(cid, tonnesCO2) on-chain.
 */

const fs = require("fs");
const path = require("path");

const PINATA_JWT = process.env.PINATA_JWT;
const file = process.argv[2];

if (!PINATA_JWT) {
  console.error("\x1b[1;31mError: PINATA_JWT not set.\x1b[0m");
  console.error("Get a free key at https://app.pinata.cloud → API Keys → New Key");
  console.error("Then run: export PINATA_JWT=your_jwt_here");
  process.exit(1);
}

if (!file) {
  console.error("\x1b[1;31mUsage: node upload-to-ipfs.cjs <path-to-json-file>\x1b[0m");
  console.error("Example: node upload-to-ipfs.cjs metadata.json");
  process.exit(1);
}

async function main() {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`\x1b[1;31mFile not found: ${filePath}\x1b[0m`);
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log("\x1b[1;36mUploading to IPFS via Pinata...\x1b[0m");

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name: path.basename(file) },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`\x1b[1;31mUpload failed (${res.status}): ${err}\x1b[0m`);
    process.exit(1);
  }

  const data = await res.json();
  const cid = data.IpfsHash;

  console.log("\x1b[1;32m✓ Uploaded successfully!\x1b[0m\n");
  console.log("CID:           " + cid);
  console.log("ipfs://" + cid);
  console.log("Gateway URL:   https://gateway.pinata.cloud/ipfs/" + cid);
  console.log("\n\x1b[90mPass this CID into registerCredit(cid, tonnesCO2) when minting.\x1b[0m");
}

main().catch((e) => {
  console.error("\x1b[1;31mError: " + e.message + "\x1b[0m");
  process.exit(1);
});
