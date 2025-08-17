import React, { useEffect, useState } from 'react'
import { BrowserProvider, Contract, Interface, parseEther, id } from 'ethers'
import governorAbi from './abi/AdvancedGovernor.json'
import tokenAbi from './abi/GovernanceToken.json'

const GOV_ADDRESS = import.meta.env.VITE_GOV_ADDRESS
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS

export default function App(){
  const [provider, setProvider] = useState(null)
  const [signer, setSigner] = useState(null)
  const [addr, setAddr] = useState('')
  const [desc, setDesc] = useState('Mint 1 GOV to me')
  const [proposalId, setProposalId] = useState(null)
  const [proposals, setProposals] = useState([])
  const [selectedProposal, setSelectedProposal] = useState(null)

  async function connect(){
    if(!window.ethereum) return alert('Install MetaMask')
    const prov = new BrowserProvider(window.ethereum)
    await prov.send('eth_requestAccounts', [])
    const s = await prov.getSigner()
    setProvider(prov); setSigner(s); setAddr(await s.getAddress())
  }

  const states = [
    "Pending", "Active", "Canceled", "Defeated",
    "Succeeded", "Queued", "Expired", "Executed"
  ];

  function g(){ 
    const abi = governorAbi.abi || governorAbi
    return new Contract(GOV_ADDRESS, abi, signer || provider) 
  }
  
  function t(){ 
    const abi = tokenAbi.abi || tokenAbi
    return new Contract(TOKEN_ADDRESS, abi, signer || provider) 
  }

  async function delegateSelf(){
    try {
      const tx = await t().delegate(addr)
      await tx.wait()
      alert('Delegated')
      await fetchProposals()
    } catch (error) {
      console.error('Delegate error:', error)
      alert('Delegation failed: ' + error.message)
    }
  }

  async function propose(){
    try {
      const iface = new Interface(['function mint(address to, uint256 amount)'])
      const calldata = iface.encodeFunctionData('mint', [addr, parseEther('1')])
      const tx = await g().propose([TOKEN_ADDRESS],[0],[calldata], desc)
      const rc = await tx.wait()
      const log = rc.logs.map(l=>g().interface.parseLog(l)).find(e=>e && e.name==='ProposalCreated')
      setProposalId(log?.args?.proposalId?.toString())
      alert('Proposed: '+ (log?.args?.proposalId?.toString() || ''))
      // Refresh proposals after creating new one
      await fetchProposals()
    } catch (error) {
      console.error('Propose error:', error)
      alert('Proposal failed: ' + error.message)
    }
  }

  async function vote(support){
    try {
      const tx = await g().castVote(proposalId, support)
      await tx.wait()
      alert('Voted')
      // Refresh proposals after voting
      await fetchProposals()
    } catch (error) {
      console.error('Vote error:', error)
      alert('Vote failed: ' + error.message)
    }
  }

  async function queue(){
    if (!proposalId) {
      alert('Please enter a proposal ID first')
      return
    }
    
    try {
      // Find the proposal data from our stored proposals
      const proposal = proposals.find(p => p.id === proposalId);
      
      if (!proposal) {
        alert('Proposal not found in local data. Please refresh proposals or check the ID.');
        return;
      }
      
      // Check if proposal is in "Succeeded" state before queuing
      const gov = g()
      const state = await gov.state(proposalId)
      const stateNames = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"]
      
      if (state !== 4n) { // 4 = Succeeded (use BigInt comparison)
        alert(`Cannot queue proposal. Current state: ${stateNames[Number(state)]}. Proposal must be in "Succeeded" state.`)
        return
      }
      
      // Create deep copies of arrays to avoid read-only issues
      // Ensure values are properly formatted as BigInt
      const targets = proposal.targets.map(t => t)
      const values = proposal.values.map(v => {
        // Handle Proxy objects or functions that can't be directly converted to BigInt
        if (typeof v === 'function' || (typeof v === 'object' && v !== null)) {
          // Try to get the actual value
          try {
            // If it's a BigNumber or similar, convert it properly
            if (v.toString && typeof v.toString === 'function') {
              return BigInt(v.toString())
            }
            // Fallback to 0n if we can't convert
            return 0n
          } catch (e) {
            // Fallback to 0n if conversion fails
            return 0n
          }
        }
        // For primitive values, convert directly
        return BigInt(v)
      })
      const calldatas = proposal.calldatas.map(c => c)
      
      // Use keccak256 hash of the description string
      const descriptionHash = id(proposal.description)
      
      console.log('Queueing with data:', {
        targets: targets,
        values: values,
        calldatas: calldatas,
        description: proposal.description,
        descriptionHash: descriptionHash
      })
      
      const tx = await gov.queue(
        targets, 
        values, 
        calldatas, 
        descriptionHash
      )
      await tx.wait()
      alert('Queued successfully!')
      await fetchProposals()
    } catch (error) {
      console.error('Queue error:', error)
      // Better error handling
      if (error.reason) {
        alert('Queue failed: ' + error.reason)
      } else if (error.data && error.data.message) {
        alert('Queue failed: ' + error.data.message)
      } else {
        alert('Queue failed: ' + error.message)
      }
    }
  }

  async function execute(){
    if (!proposalId) {
      alert('Please enter a proposal ID first')
      return
    }
    
    try {
      // Find the proposal data from our stored proposals
      const proposal = proposals.find(p => p.id === proposalId);
      
      if (!proposal) {
        alert('Proposal not found in local data. Please refresh proposals or check the ID.');
        return;
      }
      
      // Check if proposal is in "Queued" state and timelock delay has passed
      const gov = g()
      const state = await gov.state(proposalId)
      const stateNames = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"]
      
      if (state !== 5n) { // 5 = Queued (use BigInt comparison)
        alert(`Cannot execute proposal. Current state: ${stateNames[Number(state)]}. Proposal must be in "Queued" state and timelock delay must have passed.`)
        return
      }
      
      // Create deep copies of arrays to avoid read-only issues
      // Ensure values are properly formatted as BigInt
      const targets = proposal.targets.map(t => t)
      const values = proposal.values.map(v => {
        // Handle Proxy objects or functions that can't be directly converted to BigInt
        if (typeof v === 'function' || (typeof v === 'object' && v !== null)) {
          // Try to get the actual value
          try {
            // If it's a BigNumber or similar, convert it properly
            if (v.toString && typeof v.toString === 'function') {
              return BigInt(v.toString())
            }
            // Fallback to 0n if we can't convert
            return 0n
          } catch (e) {
            // Fallback to 0n if conversion fails
            return 0n
          }
        }
        // For primitive values, convert directly
        return BigInt(v)
      })
      const calldatas = proposal.calldatas.map(c => c)
      
      // Use keccak256 hash of the description string
      const descriptionHash = id(proposal.description)
      
      console.log('Executing with data:', {
        targets: targets,
        values: values,
        calldatas: calldatas,
        description: proposal.description,
        descriptionHash: descriptionHash
      })
      
      const tx = await gov.execute(
        targets, 
        values, 
        calldatas, 
        descriptionHash
      )
      await tx.wait()
      alert('Executed successfully!')
      await fetchProposals()
    } catch (error) {
      console.error('Execute error:', error)
      // Better error handling
      if (error.reason) {
        alert('Execute failed: ' + error.reason)
      } else if (error.data && error.data.message) {
        alert('Execute failed: ' + error.data.message)
      } else {
        alert('Execute failed: ' + error.message)
      }
    }
  }

  async function fetchProposals() {
    if (!provider) return;
    
    try {
      const gov = g(); // governor contract
      const filter = {
        address: GOV_ADDRESS,
        topics: [gov.interface.getEvent("ProposalCreated").topicHash],
      };

      const logs = await provider.getLogs({
        ...filter,
        fromBlock: 0n,
        toBlock: "latest",
      });

      const parsed = logs.map((l) => {
        const event = gov.interface.parseLog(l);
        
        // Handle the event args properly - they might be in different formats
        const args = event.args;
        
        // Extract arrays properly, handling both indexed and named properties
        const targets = args.targets || args[1] || [];
        const values = args.values || args[2] || [];
        const calldatas = args.calldatas || args[3] || [];
        const description = args.description || args[8] || '';
        
        return {
          id: args.proposalId || args[0],
          description: description,
          // Create new arrays from the event data
          targets: Array.isArray(targets) ? targets.map(t => t) : [targets],
          values: Array.isArray(values) ? values.map(v => v) : [values],
          calldatas: Array.isArray(calldatas) ? calldatas.map(c => c) : [calldatas],
          voteStart: args.voteStart || args[6],
          voteEnd: args.voteEnd || args[7],
          blockNumber: l.blockNumber
        };
      });

      // Deduplicate proposals by ID
      const unique = Object.values(
        parsed.reduce((acc, p) => {
          acc[p.id.toString()] = p; // dedupe by proposalId string
          return acc;
        }, {})
      );

      // Fetch live state for each proposal
      const withState = await Promise.all(
        unique.map(async (p) => {
          try {
            const s = await gov.state(p.id); // pass BigInt
            return { 
              ...p, 
              id: p.id.toString(), 
              state: states[Number(s)] || "Unknown" 
            };
          } catch (err) {
            console.error("State fetch failed for", p.id.toString(), err);
            return { 
              ...p, 
              id: p.id.toString(), 
              state: "Unknown" 
            };
          }
        })
      );

      // Sort by most recent first
      setProposals(withState.reverse());
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  }

  useEffect(() => {
    if (!provider) return;

    // Fetch immediately
    fetchProposals();

    // Auto-refresh every 15s
    const interval = setInterval(fetchProposals, 15000);

    return () => clearInterval(interval); // cleanup on unmount
  }, [provider]);

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Advanced Governor dApp</h1>
      {!addr ? <button onClick={connect}>Connect</button> : <p>Connected: {addr}</p>}
      <hr/>
      <h3>Delegate</h3>
      <button onClick={delegateSelf} disabled={!addr}>Delegate votes to self</button>
      <hr/>
      <button onClick={fetchProposals}>Refresh Proposals</button>
      <hr/>
      <h3>Create Proposal</h3>
      <input value={desc} onChange={e=>setDesc(e.target.value)} style={{width:'100%'}}/>
      <button onClick={propose} disabled={!addr}>Propose mint(1 GOV to me)</button>
      {proposalId && <p>Last proposalId: {proposalId}</p>}
      <hr/>
      <h3>Vote</h3>
      <input 
        type="text" 
        placeholder="Enter proposal ID" 
        value={proposalId || ''} 
        onChange={e=>setProposalId(e.target.value)}
        style={{width:'100%', marginBottom:'10px'}}
      />
      <button onClick={()=>vote(1)} disabled={!addr || !proposalId}>Vote For</button>
      <button onClick={()=>vote(0)} disabled={!addr || !proposalId}>Vote Against</button>
      <button onClick={()=>vote(2)} disabled={!addr || !proposalId}>Abstain</button>
      <hr/>
      <h3>Queue & Execute</h3>
      <p><strong>Instructions:</strong></p>
      <ul>
        <li>Queue: Proposal must be in "Succeeded" state (voting passed)</li>
        <li>Execute: Proposal must be in "Queued" state and timelock delay must have passed</li>
        <li>Make sure to enter the correct Proposal ID above</li>
      </ul>
      <button onClick={queue} disabled={!addr || !proposalId}>Queue</button>
      <button onClick={execute} disabled={!addr || !proposalId}>Execute</button>
      <hr/>
      <h3>Recent Proposals</h3>
      <ul>
        {proposals.map((p) => (
          <li key={p.id} style={{marginBottom: '10px'}}>
            <div>
              <code>{p.id}</code> — {p.description} ({p.state})
            </div>
            <button 
              onClick={() => setProposalId(p.id)}
              style={{marginTop: '5px', fontSize: '12px'}}
            >
              Use this ID for Queue/Execute
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
