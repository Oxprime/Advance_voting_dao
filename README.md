# Advanced Web3 Voting System (OZ v4)

Full-stack governance using OpenZeppelin **4.9.5** (Governor + ERC20Votes + Timelock), Hardhat, and a React dApp (ethers v6).

## Quickstart
```bash
npm i
npx hardhat compile
npx hardhat node
npm run deploy
```

Copy printed addresses → `.env` and `frontend/.env`:
```
VITE_GOV_ADDRESS=0x...
VITE_TOKEN_ADDRESS=0x...
```

Run dApp:
```bash
cd frontend
npm i
echo "VITE_GOV_ADDRESS=0x..." > .env
echo "VITE_TOKEN_ADDRESS=0x..." >> .env
npm run dev
```

## Pinned deps
- `@openzeppelin/contracts@4.9.5`
- Solidity `0.8.20`
- `ethers@^6`
- `hardhat@^2.22`

**Note:** v5 of OZ will break these contracts. Keep OZ pinned to 4.9.5.
