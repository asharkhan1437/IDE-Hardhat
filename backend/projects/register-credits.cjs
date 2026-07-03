const { ethers } = require('ethers');
const fs = require('fs');

const PRIVATE_KEY = 'd43e9941d5de5011d0168d2c88bb84a5d22c9914191dcfc2cf49ae567ee60c57';
const CONTRACT_ADDRESS = '0xaa1b45E01146B457A9fdE6A0DEa2472c855B7587';
const INFURA_KEY = '89469d23652842f68787a804d8f012ce';

const artifact = JSON.parse(fs.readFileSync('./artifacts/CarbonCreditRegistry.json'));
const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_KEY}`);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, wallet);

const credits = [
  { cid: 'QmQczuRoum53goVb1XVvC7cwq6scfuPX1B9jLDtappYVaG', name: 'CarbonCreditRegistry', tonnes: 1000 },
  { cid: 'QmX8UrHmuXfapQaoaP1sBUwPMun3n8LY2q3mrGoTKsbtz6', name: 'CarbonToken', tonnes: 1000 },
  { cid: 'QmdDoJ9aX6UW5vN9TP9fywYrZvmGMhQnNpYhBpvBnj5mhg', name: 'ZiconToken', tonnes: 1000 },
];

async function run() {
  console.log('Registering credits on Sepolia...\n');
  for (const c of credits) {
    console.log('Registering ' + c.name + '...');
    const tx = await contract.registerCredit(c.cid, c.tonnes);
    await tx.wait();
    console.log('Done! Tx: ' + tx.hash + '\n');
  }
  console.log('All 3 credits registered on-chain!');
}

run().catch(console.error);
