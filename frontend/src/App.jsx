// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ethers,
  BrowserProvider,
  Contract,
  Interface,
  id,
  parseEther,
} from "ethers";
import { getContracts, PROPOSAL_STATES } from "./contracts";
import {GOVERNOR_ABI} from "./contracts";

const Card = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl">
    <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
    {children}
  </div>
);

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState("");
  const [desc, setDesc] = useState("Mint 1 GOV to me");
  const [lastId, setLastId] = useState("");
  const [proposals, setProposals] = useState([]);
  const [isBusy, setIsBusy] = useState(false);

  const runner = useMemo(() => signer ?? provider, [signer, provider]);
  const { governor, token, governorAddress, tokenAddress } = useMemo(() => {
    if (!runner) return {};
    return getContracts(runner);


  }, [runner]);
console.log("Governor Address from env:", governorAddress);
console.log("Token Address from env:", tokenAddress);

  async function connect() {
    if (!window.ethereum) return alert("Install MetaMask");
    const prov = new BrowserProvider(window.ethereum);
    await prov.send("eth_requestAccounts", []);
    const s = await prov.getSigner();
    setProvider(prov);
    setSigner(s);
    setAddress(await s.getAddress());
  }

// Updated refreshProposals function with better error handling and debugging

// Updated refreshProposals function that avoids ENS resolution

async function refreshProposals() {
  if (!provider || !governor || !governorAddress) {
    console.log("Missing provider, governor, or governor address");
    return;
  }
  
  setIsBusy(true);
  try {
    console.log("Refreshing proposals...");
    console.log("Governor address:", governorAddress);
    
    // Use raw log filtering to avoid ENS issues
    const iface = new ethers.Interface(GOVERNOR_ABI);
    const eventTopic = iface.getEvent("ProposalCreated").topicHash;
    
    console.log("ProposalCreated event topic:", eventTopic);

    // Get logs directly from provider
    const logs = await provider.getLogs({
      address: governorAddress, // Use the address directly
      topics: [eventTopic],
      fromBlock: 0,
      toBlock: "latest"
    });

    console.log("Found logs:", logs.length);
    
    if (logs.length === 0) {
      console.log("No ProposalCreated events found");
      setProposals([]);
      return;
    }

    // Parse logs manually
    const parsedEvents = logs.map((log) => {
      try {
        return iface.parseLog(log);
      } catch (error) {
        console.error("Failed to parse log:", error);
        return null;
      }
    }).filter(Boolean);

    console.log("Parsed events:", parsedEvents);

    // Get proposal states
    const items = await Promise.all(
      parsedEvents.map(async (event) => {
        try {
          const pid = event.args.proposalId.toString();
          console.log(`Getting state for proposal ${pid}`);
          
          const st = await governor.state(pid);
          console.log(`Proposal ${pid} state:`, Number(st));
          
          return {
            id: pid,
            description: event.args.description,
            state: Number(st),
          };
        } catch (error) {
          console.error(`Failed to get state for proposal:`, error);
          return null;
        }
      })
    );

    const validItems = items.filter(Boolean);
    console.log("Valid proposals:", validItems);

    // Sort by newest first (reverse chronological)
    const sortedItems = validItems.reverse();
    
    setProposals(sortedItems);
    
    if (sortedItems[0]) {
      setLastId(sortedItems[0].id);
      console.log("Set lastId to:", sortedItems[0].id);
    }

  } catch (error) {
    console.error("Error in refreshProposals:", error);
    alert(`Failed to refresh proposals: ${error.message}`);
  } finally {
    setIsBusy(false);
  }
}

  async function delegateSelf() {
    if (!token) return;
    setIsBusy(true);
    try {
      const tx = await token.delegate(address);
      await tx.wait();
      alert("Delegated voting power to yourself.");
    } catch (e) {
      console.error(e);
      alert(`Delegation failed: ${e.message ?? e}`);
    } finally {
      setIsBusy(false);
    }
  }

async function proposeMint() {
  if (!governor) {
    console.log("No governor contract available");
    return;
  }
  
  setIsBusy(true);
  
  try {
    console.log("Creating proposal with description:", desc);
    console.log("Token address:", tokenAddress);
    console.log("User address:", address);
    
    const iface = new ethers.Interface(["function mint(address to,uint256 amount)"]);
    const calldata = iface.encodeFunctionData("mint", [
      address,
      ethers.parseEther("1"),
    ]);

    console.log("Generated calldata:", calldata);

    console.log("Submitting proposal...");
    const tx = await governor.propose(
      [tokenAddress],
      [0],
      [calldata],
      desc
    );
    
    console.log("Transaction submitted:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");
    console.log("Receipt:", receipt);
    
    // Check for ProposalCreated event in the receipt
    const proposalCreatedEvents = receipt.logs.filter(log => {
      try {
        const iface = new Interface(governor.interface.fragments);
        const parsed = iface.parseLog(log);
        return parsed.name === "ProposalCreated";
      } catch {
        return false;
      }
    });
    
    console.log("ProposalCreated events in receipt:", proposalCreatedEvents);
    
    if (proposalCreatedEvents.length > 0) {
      const iface = new Interface(governor.interface.fragments);
      const parsed = iface.parseLog(proposalCreatedEvents[0]);
      console.log("New proposal ID:", parsed.args.proposalId.toString());
    }
    
    // Wait longer before refreshing
    console.log("Waiting 5 seconds before refreshing...");
    setTimeout(async () => {
      await refreshProposals();
    }, 5000);
    
    alert("Proposal submitted successfully! Check console for details.");
    
  } catch (e) {
    console.error("Proposal failed:", e);
    console.error("Error details:", e.error || e.reason || e.message);
    alert(`Proposal failed: ${e.message || e.reason || e}`);
  } finally {
    setIsBusy(false);
  }
}

// Add this temporary function to your App.jsx to find contract addresses

async function findContractAddresses() {
  if (!provider) return;
  
  try {
    console.log("=== SEARCHING FOR CONTRACT ADDRESSES ===");
    
    // Get current block number
    const latestBlock = await provider.getBlockNumber();
    console.log("Latest block:", latestBlock);
    
    // Look for recent contract deployments (last 1000 blocks)
    const fromBlock = Math.max(0, latestBlock - 1000);
    
    // Get all transactions from recent blocks to find contract deployments
    for (let blockNumber = latestBlock; blockNumber >= fromBlock && blockNumber >= latestBlock - 50; blockNumber--) {
      try {
        const block = await provider.getBlock(blockNumber);
        if (block && block.transactions.length > 0) {
          console.log(`Checking block ${blockNumber} with ${block.transactions.length} transactions`);
          
          for (const txHash of block.transactions) {
            const tx = await provider.getTransaction(txHash);
            const receipt = await provider.getTransactionReceipt(txHash);
            
            // Contract deployment transactions have no 'to' address
            if (!tx.to && receipt.contractAddress) {
              console.log(`Found contract deployment at block ${blockNumber}:`);
              console.log(`  Transaction: ${txHash}`);
              console.log(`  Contract Address: ${receipt.contractAddress}`);
              console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
              
              // Try to identify if it's a governor or token by calling a simple function
              try {
                const code = await provider.getCode(receipt.contractAddress);
                if (code !== "0x") {
                  console.log(`  Contract has code (${code.length} chars)`);
                  
                  // Try to call common functions to identify the contract
                  const testContract = new ethers.Contract(
                    receipt.contractAddress, 
                    [
                      "function name() view returns (string)",
                      "function symbol() view returns (string)",
                      "function votingPeriod() view returns (uint256)",
                      "function proposalThreshold() view returns (uint256)"
                    ], 
                    provider
                  );
                  
                  // Test if it's a token
                  try {
                    const name = await testContract.name();
                    const symbol = await testContract.symbol();
                    console.log(`  ✅ TOKEN CONTRACT: ${name} (${symbol})`);
                  } catch (e) {
                    // Not a token, maybe a governor?
                    try {
                      const votingPeriod = await testContract.votingPeriod();
                      const threshold = await testContract.proposalThreshold();
                      console.log(`  ✅ GOVERNOR CONTRACT: votingPeriod=${votingPeriod}, threshold=${threshold}`);
                    } catch (e) {
                      console.log(`  ❓ Unknown contract type`);
                    }
                  }
                }
              } catch (e) {
                console.log(`  Error identifying contract: ${e.message}`);
              }
            }
          }
        }
      } catch (e) {
        console.log(`Error checking block ${blockNumber}:`, e.message);
      }
    }
    
    console.log("=== SEARCH COMPLETE ===");
    
  } catch (error) {
    console.error("Error finding addresses:", error);
  }
}


  async function cast(support) {
    if (!governor || !lastId) return;
    setIsBusy(true);
    try {
      const tx = await governor.castVote(lastId, support); // 0 against, 1 for, 2 abstain
      await tx.wait();
      await refreshProposals();
      alert("Vote cast.");
    } catch (e) {
      console.error(e);
      alert(`Vote failed: ${e.message ?? e}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function queue() {
    if (!governor) return;
    setIsBusy(true);
    try {
      const iface = new Interface(["function mint(address to,uint256 amount)"]);
      const calldata = iface.encodeFunctionData("mint", [
        address,
        parseEther("1"),
      ]);
      const dh = id(desc);
      const tx = await governor.queue(
        [tokenAddress],
        [0],
        [calldata],
        dh
      );
      await tx.wait();
      await refreshProposals();
      alert("Queued.");
    } catch (e) {
      console.error(e);
      alert(`Queue failed: ${e.message ?? e}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function execute() {
    if (!governor) return;
    setIsBusy(true);
    try {
      const iface = new Interface(["function mint(address to,uint256 amount)"]);
      const calldata = iface.encodeFunctionData("mint", [
        address,
        parseEther("1"),
      ]);
      const dh = id(desc);
      const tx = await governor.execute(
        [tokenAddress],
        [0],
        [calldata],
        dh
      );
      await tx.wait();
      await refreshProposals();
      alert("Executed 🎉");
    } catch (e) {
      console.error(e);
      alert(`Execute failed: ${e.message ?? e}`);
    } finally {
      setIsBusy(false);
    }
  }



async function testCurrentContracts() {
  console.log("=== TESTING CURRENT CONTRACTS ===");
  
  try {
    const testGovernorAddr = "0xDc64a140a3E981100a9becA4E685f962f0cf6C9";
    const testTokenAddr = "0x5FDb235567afecb367f032d93f642f64180aa3";
    
    // Try to create contracts without validation
    const governor = new ethers.Contract(testGovernorAddr, GOVERNOR_ABI, provider);
    const token = new ethers.Contract(testTokenAddr, TOKEN_ABI, provider);
    
    console.log("Contracts created successfully");
    
    // Test basic governor functions
    try {
      const votingDelay = await governor.votingDelay();
      console.log("✅ Governor votingDelay:", votingDelay.toString());
    } catch (e) {
      console.log("❌ Governor votingDelay failed:", e.message);
    }
    
    try {
      const votingPeriod = await governor.votingPeriod();
      console.log("✅ Governor votingPeriod:", votingPeriod.toString());
    } catch (e) {
      console.log("❌ Governor votingPeriod failed:", e.message);
    }
    
    // Test basic token functions
    try {
      const name = await token.name();
      console.log("✅ Token name:", name);
    } catch (e) {
      console.log("❌ Token name failed:", e.message);
    }
    
    if (address) {
      try {
        const balance = await token.balanceOf(address);
        console.log("✅ Your token balance:", ethers.formatEther(balance));
      } catch (e) {
        console.log("❌ Token balanceOf failed:", e.message);
      }
    }
    
  } catch (error) {
    console.error("Error testing contracts:", error);
  }
}
// Add this to your JSX - temporary debug button
// <button onClick={debugContractSetup} className="...">Debug Contracts</button>

  // auto refresh once connected
  useEffect(() => {
    if (provider && governor) refreshProposals();
  }, [provider, governor]);

  // UI helpers
  const canVote = proposals.find((p) => p.id === lastId)?.state === 1;
  const canQueue = proposals.find((p) => p.id === lastId)?.state === 4;
  const canExecute = proposals.find((p) => p.id === lastId)?.state === 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#12022F] to-[#2B0B5E] text-white">
      {/* Top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-600/80 shadow">
            <span className="text-xl">⚙️</span>
          </div>
          <h1 className="text-xl font-semibold">Advanced DAO</h1>
        </div>
        <button
          onClick={connect}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
        >
          {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect Wallet"}
        </button>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-8 text-center">
        <h2 className="mb-3 text-4xl font-bold">Decentralized Governance</h2>
        <p className="text-white/70">
          Delegate votes, create proposals, vote, queue & execute with a timelock.
        </p>
      </section>

      {/* Grid */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-24 md:grid-cols-2">
        {/* Voting Power */}
        <Card title="🧑‍🤝‍🧑 Voting Power">
          <p className="mb-4 text-sm text-white/70">
            Delegate your voting power to yourself to participate.
          </p>
          <button
            disabled={!address || isBusy}
            onClick={delegateSelf}
            className="rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold hover:bg-fuchsia-500 disabled:opacity-40"
          >
            Delegate votes to self
          </button>
        </Card>

        {/* Recent Proposals */}
        <Card title="📰 Recent Proposals">
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={refreshProposals}
              disabled={!provider || isBusy}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40"
            >
              Refresh
            </button>
            {lastId && (
              <span className="truncate text-xs text-white/60">
                Last: <code className="text-white/80">{lastId}</code>
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="rounded-xl bg-white/5 px-3 py-2 text-sm"
              >
                <div className="truncate">
                  <code className="text-white/80">{p.id}</code> — {p.description}
                </div>
                <div className="mt-0.5 text-xs text-white/60">
                  {PROPOSAL_STATES[p.state] ?? "Unknown"}
                </div>
                <button
                  className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                  onClick={() => setLastId(p.id)}
                >
                  Use this ID
                </button>
              </li>
            ))}
            {!proposals.length && (
              <li className="text-sm text-white/60">No proposals found.</li>
            )}
          </ul>
        </Card>

        {/* Create Proposal */}
        <Card title="➕ Create Proposal">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="mb-3 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40"
            placeholder="Description"
          />
          <button
            disabled={!address || isBusy}
            onClick={proposeMint}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40"
          >
            Propose mint(1 GOV to me)
          </button>
        </Card>

        {/* Vote / Queue / Execute */}
        <Card title="🗳️ Vote • ⏳ Queue • ✅ Execute">
          <div className="mb-3 text-xs text-white/70">
            Choose a proposal from “Recent Proposals” or use the last created one.
          </div>

          <div className="mb-4 flex gap-2">
            <button
              onClick={() => cast(1)}
              disabled={!address || !lastId || !canVote || isBusy}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40"
            >
              Vote For
            </button>
            <button
              onClick={() => cast(0)}
              disabled={!address || !lastId || !canVote || isBusy}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40"
            >
              Vote Against
            </button>
            <button
              onClick={() => cast(2)}
              disabled={!address || !lastId || !canVote || isBusy}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40"
            >
              Abstain
            </button>
<div className="flex gap-2">


</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={queue}
              disabled={!address || !lastId || !canQueue || isBusy}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40"
            >
              Queue
            </button>
            <button
              onClick={execute}
              disabled={!address || !lastId || !canExecute || isBusy}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold hover:bg-teal-500 disabled:opacity-40"
            >
              Execute
            </button>
          </div>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-white/60">
            <li>Queue requires state = <b>Succeeded</b>.</li>
            <li>Execute requires state = <b>Queued</b> and timelock passed.</li>
          </ul>
        </Card>
      </main>
    </div>
  
  );
}
