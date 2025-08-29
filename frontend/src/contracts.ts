// src/contracts.ts
import { ethers } from "ethers";

// --- Complete Governor ABI for OpenZeppelin Governor with TimelockControl ---
export const GOVERNOR_ABI = [
  // Core view functions
  "function state(uint256 proposalId) view returns (uint8)",
  "function quorum(uint256 blockNumber) view returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function votingDelay() view returns (uint256)",
  "function votingPeriod() view returns (uint256)",
  "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
  "function proposalDeadline(uint256 proposalId) view returns (uint256)",
  "function hasVoted(uint256 proposalId, address account) view returns (bool)",
  "function getVotes(address account, uint256 blockNumber) view returns (uint256)",
  
  // Core write functions
  "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support) returns (uint256)",
  "function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)",
  
  // Timelock functions
  "function queue(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
  "function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) payable returns (uint256)",
  "function cancel(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
  "function timelock() view returns (address)",
  
  // Events - matching OpenZeppelin Governor exactly
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)",
  "event ProposalQueued(uint256 proposalId, uint256 eta)",
  "event ProposalExecuted(uint256 proposalId)",
  "event ProposalCanceled(uint256 proposalId)",
  "event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)"
];

// --- Complete Token ABI (ERC20Votes + AccessControl) ---
export const TOKEN_ABI = [
  // Standard ERC20 functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // ERC20Votes functions
  "function getVotes(address) view returns (uint256)",
  "function getPastVotes(address account, uint256 blockNumber) view returns (uint256)",
  "function getPastTotalSupply(uint256 blockNumber) view returns (uint256)",
  "function delegate(address delegatee)",
  "function delegates(address account) view returns (address)",
  "function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)",
  
  // Mint function
  "function mint(address to, uint256 amount)",
  
  // AccessControl functions
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function revokeRole(bytes32 role, address account)",
  "function getRoleAdmin(bytes32 role) view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)",
  "event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance)",
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)"
];

export const PROPOSAL_STATES = {
  0: "Pending",
  1: "Active",
  2: "Canceled",
  3: "Defeated",
  4: "Succeeded",
  5: "Queued",
  6: "Expired",
  7: "Executed",
} as const;

export type ProposalState = keyof typeof PROPOSAL_STATES;

export const getContracts = (runner: ethers.AbstractProvider | ethers.Signer) => {
  // Your deployed contract addresses - verify these are correct!
  // Try to get addresses from environment variables, with fallback to hardcoded values
  const governorAddress = import.meta.env?.VITE_GOV_ADDRESS || "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
  const tokenAddress = import.meta.env?.VITE_TOKEN_ADDRESS || "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  console.log("Creating contracts with addresses:");
  console.log("Governor:", governorAddress, "Length:", governorAddress.length);
  console.log("Token:", tokenAddress, "Length:", tokenAddress.length);
  
  // Check if addresses look valid (42 characters including 0x)
  if (governorAddress.length !== 42) {
    console.error("Governor address has wrong length:", governorAddress.length, "should be 42");
    console.error("Address:", governorAddress);
  }
  
  if (tokenAddress.length !== 42) {
    console.error("Token address has wrong length:", tokenAddress.length, "should be 42");
    console.error("Address:", tokenAddress);
  }

  // Try to validate addresses, but don't throw error if validation fails
  try {
    if (!ethers.isAddress(governorAddress)) {
      console.warn(`Warning: Governor address might be invalid: ${governorAddress}`);
    }
    if (!ethers.isAddress(tokenAddress)) {
      console.warn(`Warning: Token address might be invalid: ${tokenAddress}`);
    }
  } catch (validationError) {
    console.warn("Address validation failed:", validationError);
  }

  // Create contracts without strict validation for now
  try {
    const governor = new ethers.Contract(governorAddress, GOVERNOR_ABI, runner);
    const token = new ethers.Contract(tokenAddress, TOKEN_ABI, runner);

    return { governor, token, governorAddress, tokenAddress };
  } catch (error) {
    console.error("Error creating contracts:", error);
    throw error;
  }
};
