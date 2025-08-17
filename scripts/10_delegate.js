const { ethers } = require("hardhat");
async function main() {
  const token = await ethers.getContractAt("GovernanceToken", process.env.TOKEN_ADDRESS);
  await (await token.delegate(process.env.DELEGATE_TO)).wait();
  console.log("Delegated to", process.env.DELEGATE_TO);
}
main().catch(console.error);
