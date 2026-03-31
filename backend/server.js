import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';
import { ethers } from 'ethers';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Set your workspace directory
const PROJECTS_DIR = path.join(__dirname, 'projects');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Ensure directories exist
fs.ensureDirSync(PROJECTS_DIR);
fs.ensureDirSync(TEMPLATES_DIR);

const purchasedExtensions = {}; 

// ── GITHUB APP CREDENTIALS ──
const CLIENT_ID = "Ov23li2xmxwOUm9hqgib"; 
const CLIENT_SECRET = "49e4809f04bd12faecc42ce7290df46614904270"; 

// Helper: Recursively read directory into a flat object for the IDE
const readDirectoryRecursive = (dir, rootDir, fileList = {}) => {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      if (!['.git', 'node_modules', 'dist', '.next', 'cache', 'artifacts'].includes(item)) {
        readDirectoryRecursive(fullPath, rootDir, fileList);
      }
    } else {
      const relativePath = path.relative(rootDir, fullPath);
      fileList[relativePath] = fs.readFileSync(fullPath, 'utf8');
    }
  });
  return fileList;
};

// ── GITHUB AUTH CALLBACK ──
app.get('/api/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided by GitHub");
  try {
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
      { headers: { Accept: 'application/json' } }
    );
    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) throw new Error("Failed to obtain access token");
    res.redirect(`http://localhost:5173/?token=${accessToken}`);
  } catch (err) {
    res.status(500).send("Authentication failed");
  }
});

// ── 1. AUTOSAVE ──
app.post('/api/save', async (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: "No path" });
  const fullPath = path.join(PROJECTS_DIR, filePath);
  try {
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. GITHUB CLONE ──
app.post('/api/clone', async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ success: false, message: "No URL" });

  const repoName = repoUrl.split('/').pop().replace('.git', '');
  const clonePath = path.join(PROJECTS_DIR, repoName);

  try {
    await fs.ensureDir(PROJECTS_DIR);
    if (await fs.pathExists(clonePath)) await fs.remove(clonePath); 

    const git = simpleGit();
    await git.clone(repoUrl, clonePath);

    const files = readDirectoryRecursive(clonePath, clonePath);
    res.json({ success: true, files, repoName });
  } catch (err) {
    console.error("Clone Error:", err.message);
    res.status(500).json({ success: false, message: "Clone failed." });
  }
});

// ── 3. GITHUB PUSH ──
app.post('/api/push', async (req, res) => {
  const { files, token, repoName, repoUrl } = req.body;
  if (!repoUrl || !token) return res.status(400).json({ success: false, message: "Missing URL or Token" });
  const repoPath = path.join(PROJECTS_DIR, repoName);

  try {
    await fs.ensureDir(repoPath);
    for (const [fPath, content] of Object.entries(files)) {
      const full = path.join(repoPath, fPath);
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, content);
    }

    const git = simpleGit(repoPath);
    if (!(await git.checkIsRepo())) await git.init();
    
    await git.addConfig('user.email', 'zicon-ide@bot.com');
    await git.addConfig('user.name', 'Zicon IDE');

    const cleanUrl = repoUrl.replace(/^https?:\/\//, '');
    const authUrl = `https://${token}@${cleanUrl}`;

    await git.add('.');
    await git.commit(`Zicon Sync: ${new Date().toLocaleString()}`);
    
    try { await git.push(authUrl, 'main'); } 
    catch (e) { await git.push(authUrl, 'master'); }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 4. WEB3 VERIFICATION ──
app.post('/api/verify-payment', async (req, res) => {
  const { txHash, address, extensionId } = req.body;
  try {
    const provider = new ethers.JsonRpcProvider("https://rpc.ankr.com/eth_sepolia");
    const tx = await provider.getTransaction(txHash);
    const target = "0xA9FAABCD9372AA1FCD175c3f1a7CfA0b0f8a7916".toLowerCase();
    
    if (tx.to.toLowerCase() !== target || tx.value < ethers.parseEther("0.0001")) {
       return res.status(400).json({ success: false, message: "Invalid Payment" });
    }
    if (!purchasedExtensions[address]) purchasedExtensions[address] = [];
    purchasedExtensions[address].push(extensionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

// ── 5. SOLIDITY AUDIT ──
app.post('/api/audit-solidity', async (req, res) => {
  const { address, signature, message, content } = req.body;
  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) return res.status(401).json({ success: false });
    const reports = [];
    if (content.includes("selfdestruct")) reports.push("🚨 CRITICAL: selfdestruct found!");
    if (content.includes("tx.origin")) reports.push("⚠️ WARNING: tx.origin detected.");
    if (content.includes("delegatecall")) reports.push("🚨 HIGH: delegatecall found.");
    if (!content.includes("ReentrancyGuard")) reports.push("ℹ️ Suggestion: Use ReentrancyGuard.");
    res.json({ success: true, reports: reports.length ? reports : ["✅ Clear!"] });
  } catch (err) { res.status(500).json({ success: false }); }
});

// ── 6. CARBON ENGINE ──
app.post('/api/initialize-carbon', async (req, res) => {
  const { walletAddress, projectName } = req.body;
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const templatePath = path.join(TEMPLATES_DIR, 'carbon');

  try {
    await fs.ensureDir(projectPath);
    if (await fs.pathExists(templatePath)) {
      await fs.copy(templatePath, projectPath);
      const readmePath = path.join(projectPath, 'README.md');
      await fs.writeFile(readmePath, `# ${projectName}\nInjected by Zicon Carbon Engine\nOwner: ${walletAddress}`);
      const files = readDirectoryRecursive(projectPath, projectPath);
      res.json({ success: true, files });
    } else {
      res.status(404).json({ success: false, error: "Carbon template not found on server." });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 7. WORKSPACE LOADER ──
app.get('/api/files', async (req, res) => {
  try {
    if (await fs.pathExists(PROJECTS_DIR)) {
      const files = readDirectoryRecursive(PROJECTS_DIR, PROJECTS_DIR);
      res.json(files);
    } else { res.json({}); }
  } catch (err) { res.status(500).json({ error: "Failed to load workspace" }); }
});

// ── 8. DELETE FILE OR FOLDER ──
app.post('/api/delete', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ success: false, message: "No path" });

  const fullPath = path.join(PROJECTS_DIR, filePath);
  console.log(`🗑️ Request to delete: ${fullPath}`);

  try {
    await fs.remove(fullPath); 
    console.log(`✅ Deleted successfully: ${filePath}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Delete error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 9. MOVE OR RENAME ──
app.post('/api/move', async (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ success: false, message: "Missing paths" });

  const fullOldPath = path.join(PROJECTS_DIR, oldPath);
  const fullNewPath = path.join(PROJECTS_DIR, newPath);

  console.log(`🚚 Moving from: ${fullOldPath}`);
  console.log(`👉 Moving to:   ${fullNewPath}`);

  try {
    // 1. Double check if original exists
    if (!(await fs.pathExists(fullOldPath))) {
        console.error("❌ Move failed: Original file doesn't exist on disk.");
        return res.status(404).json({ success: false, error: "Original file not found" });
    }

    // 2. Ensure destination directory exists
    await fs.ensureDir(path.dirname(fullNewPath));

    // 3. Perform move
    await fs.move(fullOldPath, fullNewPath, { overwrite: true });
    
    console.log(`✅ Move successful!`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Move error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(5000, () => console.log(`🚀 Zicon Backend running at http://localhost:5000`));