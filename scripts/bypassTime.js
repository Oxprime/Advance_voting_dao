const { ethers, network, artifacts } = require("hardhat");

async function main() {

  const GOVERNOR_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  const PROPOSAL_ID = "35661706548893424151918724877798635624791478162187004813395398018588595727908"; 

const govArtifact = await artifacts.readArtifact("AdvancedGovernor");
  const [signer] = await ethers.getSigners();
  const governor = new ethers.Contract(GOVERNOR_ADDRESS, govArtifact.abi, signer);

  const states = {
    0: "Pending",
    1: "Active",
    2: "Canceled",
    3: "Defeated",
    4: "Succeeded",
    5: "Queued",
    6: "Expired",
    7: "Executed",
  };

  let state;
  while (true) {
    state = await governor.state(PROPOSAL_ID);
    console.log(`📌 Current state: ${state} (${states[state]})`);

    if (state == 4 || state == 3 || state == 2 || state == 6 || state == 7) {
      console.log("✅ Final state reached. Exiting.");
      break;
    }

    // Mine 5 more blocks and try again
    console.log("⛏️ Mining 5 blocks...");
    await network.provider.send("hardhat_mine", ["0x5"]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
