const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EIP-712 castVoteBySig (OZ v4)", function () {
  it("votes by signature", async function () {
    const [deployer, signer] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("GovernanceToken");
    const token = await Token.deploy("GovToken", "GOV");
    await token.waitForDeployment();
    await (await token.mint(signer.address, ethers.parseEther("10"))).wait();
    await (await token.connect(signer).delegate(signer.address)).wait();

    const Timelock = await ethers.getContractFactory("TimelockController");
    const timelock = await Timelock.deploy(0, [], []);
    await timelock.waitForDeployment();

    const Gov = await ethers.getContractFactory("AdvancedGovernor");
    const gov = await Gov.deploy(token.target, timelock.target, 1n, 5n, 0n, 4);
    await gov.waitForDeployment();

    await (await timelock.grantRole(await timelock.PROPOSER_ROLE(), gov.target)).wait();
    await (await timelock.grantRole(await timelock.EXECUTOR_ROLE(), ethers.ZeroAddress)).wait();

    const targets = [token.target];
    const values = [0];
    const iface = new ethers.Interface(["function mint(address to, uint256 amount)"]);
    const calldatas = [iface.encodeFunctionData("mint", [deployer.address, 1n])];

    const tx = await gov.propose(targets, values, calldatas, "sig vote");
    const rc = await tx.wait();
    const proposalId = rc.logs.map(l => gov.interface.parseLog(l)).find(e => e && e.name === 'ProposalCreated').args.proposalId;

    await ethers.provider.send("hardhat_mine", ["0x1"]);

    const domain = {
      name: "AdvancedGovernor",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await gov.getAddress(),
    };

    const types = {
      Ballot: [
        { name: "proposalId", type: "uint256" },
        { name: "support", type: "uint8" },
      ],
    };

    const value = { proposalId, support: 1 };

    const sig = await signer.signTypedData(domain, types, value);
    const { r, s, v } = ethers.Signature.from(sig);

    await (await gov.castVoteBySig(proposalId, 1, v, r, s)).wait();

    const votes = await gov.proposalVotes(proposalId);
    expect(votes.forVotes).to.not.equal(0n);
  });
});
