# Namma Global Trader

**Cross-chain DeFi trading platform powered by Yellow Network’s Nitrolite state channels.**

---

## 🏆 Built For

* **Yellow Network** – State Channel Innovation
* **LI.FI** – Composer, AI Integration, DeFi Integration *(3 prizes)*
* **ENS** – Identity & Resolution
* **Arc Protocol** – Intent-Based Chain Abstraction
* **Uniswap** – Dynamic Fee Hooks
* **Sui** – Cross-Chain Destination

---

## 🟡 Yellow Network: Why State Channels?

### The Problem with Traditional DeFi

Every on-chain transaction requires:

* 💸 Gas fees ($5–$50 per swap)
* ⏰ Block confirmation time (12–15 seconds)
* 🐌 Network congestion delays
* 💰 Makes small trades uneconomical

**Result:** Users often pay more in gas than they make in small trades.

---

### The Nitrolite Solution

Yellow Network’s **ERC-7824 Nitrolite** state channels enable:

* ⚡ **Instant execution**: <1 second per trade
* 💎 **Zero gas**: $0 per swap after initial channel deposit
* 🔒 **Secure**: On-chain dispute resolution
* 📈 **Scalable**: Unlimited trades per channel

---

## 🔁 How It Works

### 1. Open a Trading Session

User deposits **100 USDC** → opens state channel
Channel stays open for unlimited trades
All trades execute **off-chain, gaslessly**

---

### 2. Execute Unlimited Trades

* Trade 1: 10 USDC → SUI *(0.8s, $0 gas)* ✅
* Trade 2: 10 USDC → SUI *(0.7s, $0 gas)* ✅
* Trade 3: 10 USDC → SUI *(0.9s, $0 gas)* ✅

Balance tracked in channel state.

---

### 3. Close & Settle Once

Close channel → settle final state on-chain
All trades finalized in **ONE** transaction
Withdraw remaining balance.

---

## ⚔️ Real Demo Comparison

**Traditional DEX (Uniswap):**

* 3 swaps = 3 transactions
* Gas: ~$30 (3 × $10)
* Time: ~45s
* Total cost: High ❌

**Namma Global Trader:**

* 3 swaps = 1 channel
* Gas: $0 per swap
* Time: ~3s total
* Total cost: Minimal ✅

> **15× faster, 100% gas savings.**

---

## ✅ Key Features

* Session-Based Trading
* Balance Integrity
* Instant Finality
* Gasless Execution
* On-Chain Settlement
* Cross-Protocol Integration

---

## 🛠️ Technical Implementation

**Smart Contracts (Sepolia):**

* Custody: `0xf7e7a089344e74ab847e74f81a6d50cad28e6418`
* Token: YTEST (mock USDC)
* Protocol: ERC-7824
* Challenge Period: 3600s

### State Channel Flow

```javascript
// 1. Create channel
const channel = await createChannel({ depositAmount: 100 });

// 2. Off-chain trades
await submitIntent({
  amountIn: 10,
  tokenOut: 'SUI',
  channelId: channel.id
});

// 3. Settle on-chain
await closeChannel(channel.id);
```

**Balance Management**

* Real-time tracking
* Auto deduction
* Insufficient balance checks
* On-chain verification

---

## 🌉 LI.FI Integration

### 1. 🎨 Composer (Multi-Step Routes)

**Example Route**

```
USDC (Sepolia)
   ↓ Swap (Uniswap V3)
ETH
   ↓ Bridge (Across)
ETH (Base Sepolia)
   ↓ Swap
SUI
```

```javascript
import { getRoutes } from '@lifi/sdk';

const routes = await getRoutes({
  fromChainId: 11155111,
  toChainId: 84532,
  fromTokenAddress: USDC_ADDRESS,
  toTokenAddress: SUI_ADDRESS,
  fromAmount: parseUnits("10", 6),
  options: {
    order: 'RECOMMENDED',
    slippage: 0.05,
    bridges: { allow: ['across', 'stargate', 'hop'] }
  }
});
```

---

### 2. 🤖 AI x LI.FI (Intent-Based Trading)

```json
{
  "want": "SUI",
  "have": "USDC",
  "amount": 10,
  "prefer": "fastest"
}
```

System:

* AI interprets
* LI.FI finds route
* State channel executes
* User pays $0 gas

---

### 3. 🏆 Best DeFi Integration

```
User Intent
     ↓
State Channel (Yellow)
     ↓
LI.FI Route Engine
     ↓
Final Execution
```

---

## 🏷️ ENS Integration

```javascript
const address = await provider.resolveName('vitalik.eth');
const ensName = await provider.lookupAddress('0xce5990...');
const avatar = await provider.getAvatar('vitalik.eth');
```

---

## 🎯 Arc Protocol: Intent-Based Abstraction

```javascript
const intent = {
  tokenIn: 'USDC',
  tokenOut: 'SUI',
  amountIn: 10,
  minAmountOut: 9.5,
  deadline: Date.now() + 300000
};
```

Solvers compete → best quote wins → executes via LI.FI.

---

## 🦄 Uniswap v4: Dynamic Fee Hooks

```javascript
function getDynamicFee(trader) {
  const BASE = 3000;
  const MIN = 1000;
  const reduction = Math.floor(totalVolume / 100) * 500;
  return Math.max(BASE - reduction, MIN) / 10000;
}
```

| Volume  | Fee   | Savings |
| ------- | ----- | ------- |
| 0–100   | 0.30% | Base    |
| 100–200 | 0.25% | 17%     |
| 200–300 | 0.20% | 33%     |
| 500+    | 0.10% | 67%     |

---

## 🏗️ Architecture

```
Frontend (Next.js)
        ↓
Backend (Express + Node)
        ↓
ERC-7824 State Channels
        ↓
LI.FI / Arc / ENS / Uniswap / Sui
```

---

## 📊 Key Metrics

* ⚡ <1s execution
* 💰 100% gas savings per swap
* 🔗 15+ bridges
* ⛓️ Sepolia, Base Sepolia, Sui

---

## 🔮 Roadmap

**Phase 1:** Mainnet
**Phase 2:** Multi-user, limits, automation
**Phase 3:** Mobile, bots, governance

---

## 🎥 Demo Video

> *(Add your link here)*
