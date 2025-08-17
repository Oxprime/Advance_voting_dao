const { expect } = require("chai");
const { ethers } = require("hardhat");

async function mineBlocks(n) {
  for (let i = 0; i < n; i++) await ethers.provider.send("hardhat_mine", ["0x1"]);
}

describe("Governor Flow (OZ v4)", function () {
  it("propose -> vote -> queue -> execute", async function () {
    const [deployer, voter] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("GovernanceToken");
    const token = await Token.deploy("GovToken", "GOV");
    await token.waitForDeployment();

    await (await token.mint(deployer.address, ethers.parseEther("1000"))).wait();
    await (await token.delegate(deployer.address)).wait();

    const Timelock = await ethers.getContractFactory("TimelockController");
    const timelock = await Timelock.deploy(2, [], []);
    await timelock.waitForDeployment();

    const Gov = await ethers.getContractFactory("AdvancedGovernor");
    const gov = await Gov.deploy(token.target, timelock.target, 1n, 5n, 0n, 4);
    await gov.waitForDeployment();

    await (await timelock.grantRole(await timelock.PROPOSER_ROLE(), gov.target)).wait();
    await (await timelock.grantRole(await timelock.EXECUTOR_ROLE(), ethers.ZeroAddress)).wait();

    const targets = [token.target];
    const values = [0];
    const iface = new ethers.Interface(["function mint(address to, uint256 amount)"]);
    const calldatas = [iface.encodeFunctionData("mint", [voter.address, ethers.parseEther("1")])];
    const description = "Mint 1 GOV to voter";

    const tx = await gov.propose(targets, values, calldatas, description);
    const rc = await tx.wait();
    const ev = rc.logs.map(l => gov.interface.parseLog(l)).find(e => e && e.name === 'ProposalCreated');
    const proposalId = ev?.args?.proposalId ?? (await gov.hashProposal(targets, values, calldatas, ethers.id(description)));

    await mineBlocks(1);
    await (await gov.castVote(proposalId, 1)).wait();
    await mineBlocks(5);

    const descHash = ethers.id(description);
    await (await gov.queue(targets, values, calldatas, descHash)).wait();
    await (await gov.execute(targets, values, calldatas, descHash)).wait();

    expect(await token.balanceOf(voter.address)).to.equal(ethers.parseEther("1"));
  });
});
