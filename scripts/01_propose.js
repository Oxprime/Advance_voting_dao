const { ethers } = require("hardhat");
async function main() {
  const gov = await ethers.getContractAt("AdvancedGovernor", process.env.GOV_ADDRESS);
  const tokenAddr = process.env.TOKEN_ADDRESS;
  const voter = process.env.VOTER;
  const iface = new ethers.Interface(["function mint(address to, uint256 amount)"]);
  const calldata = iface.encodeFunctionData("mint", [voter, ethers.parseEther("10")]);
  const tx = await gov.propose([tokenAddr],[0],[calldata],"Mint 10 GOV to voter");
  const rc = await tx.wait();
  console.log("Proposed. Tx:", rc.hash);
}
main().catch(console.error);
