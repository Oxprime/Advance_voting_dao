const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // --- Deploy Governance Token ---
  const Token = await ethers.getContractFactory("GovernanceToken");
  const token = await Token.deploy("GovToken", "GOV");
  await token.waitForDeployment();
  console.log("Token:", token.target);

  // Mint initial supply and delegate
  await (await token.mint(deployer.address, ethers.parseEther("1000000"))).wait();
  await (await token.delegate(deployer.address)).wait();

  // --- Deploy Timelock ---
  const Timelock = await ethers.getContractFactory("TimelockController");
  const minDelay = 3600; // 1 hour
  
  // TimelockController constructor parameters:
  // minDelay, proposers[], executors[], admin
  const timelock = await Timelock.deploy(
    minDelay,           // minimum delay
    [],                 // proposers (will be set later)
    [],                 // executors (will be set later) 
    deployer.address    // admin (deployer initially)
  );
  await timelock.waitForDeployment();
  console.log("Timelock:", timelock.target);

  // --- Deploy Governor ---
  const Gov = await ethers.getContractFactory("AdvancedGovernor");
  const gov = await Gov.deploy(token.target, timelock.target);
  await gov.waitForDeployment();
  console.log("Governor:", gov.target);

  // --- Grant Roles ---
  // Grant PROPOSER_ROLE to the governor contract
  await (await timelock.grantRole(await timelock.PROPOSER_ROLE(), gov.target)).wait();
  
  // Grant EXECUTOR_ROLE to everyone (ZeroAddress means anyone can execute)
  await (await timelock.grantRole(await timelock.EXECUTOR_ROLE(), ethers.ZeroAddress)).wait();
  
  // Optional: Revoke admin role from deployer to make it fully decentralized
  // await (await timelock.revokeRole(await timelock.TIMELOCK_ADMIN_ROLE(), deployer.address)).wait();

  console.log("✅ Deployment complete");
  console.log("=".repeat(50));
  console.log("Contract Addresses:");
  console.log("Token:", token.target);
  console.log("Timelock:", timelock.target);
  console.log("Governor:", gov.target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});