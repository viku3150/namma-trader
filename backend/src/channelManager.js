import { ethers } from "ethers";
import WebSocket from "ws";
import { LiFiService } from "../services/lifi.service.js";
import dotenv from "dotenv";

dotenv.config();

const CLEARNODE_WS = "wss://clearnet.yellow.com/ws";
const SEPOLIA_CHAIN_ID = 11155111;
const SUI_CHAIN_ID = 101; // Sui mainnet chain ID
const YTEST_TOKEN = "0x51447ec4B7478C2fA6583E98Bff28Fcba88BeE85";
const CHALLENGE_DURATION = 3600;

// YOUR DEPLOYED CUSTODY CONTRACT ADDRESS
const CUSTODY_ADDRESS = "0xf7e7a089344e74ab847e74f81a6d50cad28e6418"; // ⚠️ UPDATE THIS!

class ChannelManager {
	constructor(privateKey, rpcUrl) {
		this.provider = new ethers.JsonRpcProvider(rpcUrl);
		this.wallet = new ethers.Wallet(privateKey, this.provider);
		this.ws = null;
		this.activeChannels = new Map();
		this.pendingIntents = new Map();

		// Initialize LI.FI service
		this.lifi = new LiFiService();

		console.log("✅ Wallet initialized:", this.wallet.address);
		console.log("📍 Custody contract:", CUSTODY_ADDRESS);
	}

	async connect() {
		console.log("🔌 Initializing channel manager...");

		// Connect WebSocket for intent messaging (optional)
		this.ws = new WebSocket(CLEARNODE_WS);

		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				console.log("⏭️  Continuing without WebSocket");
				resolve();
			}, 5000);

			this.ws.on("open", () => {
				clearTimeout(timeout);
				console.log("✅ Connected to WebSocket");
				this.setupMessageHandlers();
				resolve();
			});

			this.ws.on("error", () => {
				clearTimeout(timeout);
				console.log("⏭️  Continuing without WebSocket");
				resolve();
			});
		});
	}

	setupMessageHandlers() {
		this.ws.on("message", async (data) => {
			try {
				const message = JSON.parse(data.toString());
				console.log("📨 Received message:", message.type);

				switch (message.type) {
					case "intent_fulfilled":
						await this.handleIntentFulfilled(message.data);
						break;
					case "solver_quote":
						await this.handleSolverQuote(message.data);
						break;
					default:
						console.log("⚠️  Unknown message:", message.type);
				}
			} catch (error) {
				console.error("❌ Error processing message:", error);
			}
		});
	}

	/**
	 * Resolve ENS name to address or address to ENS name
	 */
	async resolveENS(nameOrAddress) {
		try {
			if (nameOrAddress.includes(".eth")) {
				// Resolve ENS name to address
				const address = await this.provider.resolveName(nameOrAddress);
				return address || nameOrAddress;
			} else if (nameOrAddress.startsWith("0x")) {
				// Lookup reverse ENS
				const ensName = await this.provider.lookupAddress(nameOrAddress);
				return ensName || nameOrAddress;
			}
			return nameOrAddress;
		} catch (error) {
			console.error("⚠️  ENS resolution failed:", error.message);
			return nameOrAddress;
		}
	}

	/**
	 * Create a new state channel
	 */
	async createChannel(depositAmount) {
		console.log(`🔧 Creating channel...`);

		try {
			// Generate unique channel ID
			const channelId = ethers.keccak256(
				ethers.solidityPacked(
					["address", "uint256"],
					[this.wallet.address, Date.now()],
				),
			);

			// Create channel on-chain
			const custodyContract = new ethers.Contract(
				CUSTODY_ADDRESS,
				[
					"function createChannel(bytes32 channelId, address token) external",
					"function getChannel(bytes32) view returns (address, address, uint256, uint256, bool)",
				],
				this.wallet,
			);

			console.log("⏳ Creating channel on-chain...");
			const tx = await custodyContract.createChannel(channelId, YTEST_TOKEN);
			const receipt = await tx.wait();
			console.log("✅ Channel created on-chain:", receipt.hash);

			// Try to resolve ENS name
			const ensName = await this.resolveENS(this.wallet.address);

			const channelData = {
				channelId,
				address: this.wallet.address,
				ensName: ensName !== this.wallet.address ? ensName : null,
				balance: 0,
				token: YTEST_TOKEN,
				createdAt: Date.now(),
				status: "created",
				custodyAddress: CUSTODY_ADDRESS,
				txHash: receipt.hash,
			};

			this.activeChannels.set(channelId, channelData);
			console.log(`✅ Channel ID: ${channelId}`);
			return channelData;
		} catch (error) {
			console.error("❌ Error creating channel:", error);
			throw error;
		}
	}

	/**
	 * Deposit tokens into a channel
	 */
	async depositToChannel(channelId, amount) {
		console.log(`💰 Depositing ${amount} USDC to channel...`);

		const channel = this.activeChannels.get(channelId);
		if (!channel) throw new Error("Channel not found");

		try {
			const custodyContract = new ethers.Contract(
				CUSTODY_ADDRESS,
				["function deposit(bytes32 channelId, uint256 amount) external"],
				this.wallet,
			);

			const tokenContract = new ethers.Contract(
				YTEST_TOKEN,
				[
					"function approve(address spender, uint256 amount) returns (bool)",
					"function decimals() view returns (uint8)",
				],
				this.wallet,
			);

			const decimals = await tokenContract.decimals();
			const amountWei = ethers.parseUnits(amount.toString(), decimals);

			console.log("⏳ Approving tokens...");
			const approveTx = await tokenContract.approve(CUSTODY_ADDRESS, amountWei);
			await approveTx.wait();
			console.log("✅ Tokens approved");

			console.log("⏳ Depositing...");
			const depositTx = await custodyContract.deposit(channelId, amountWei);
			const receipt = await depositTx.wait();
			console.log("✅ Deposit complete:", receipt.hash);

			channel.balance = parseFloat(channel.balance) + parseFloat(amount);
			channel.status = "active";
			this.activeChannels.set(channelId, channel);

			return receipt.hash;
		} catch (error) {
			console.error("❌ Error depositing:", error);
			throw error;
		}
	}

	/**
	 * Get channel balance from on-chain contract
	 */
	async getChannelBalance(channelId) {
		const channel = this.activeChannels.get(channelId);
		if (!channel) throw new Error("Channel not found");

		try {
			const custodyContract = new ethers.Contract(
				CUSTODY_ADDRESS,
				["function getBalance(bytes32) view returns (uint256)"],
				this.provider,
			);

			const balance = await custodyContract.getBalance(channelId);
			const formatted = ethers.formatUnits(balance, 6);

			return {
				available: formatted,
				locked: "0",
				total: formatted,
			};
		} catch (error) {
			console.error("⚠️  Error getting balance:", error.message);
			return {
				available: channel.balance.toString(),
				locked: "0",
				total: channel.balance.toString(),
			};
		}
	}

	/**
	 * Submit a trading intent with LI.FI integration
	 */
	async submitIntent(channelId, intent) {
		console.log(`📤 Submitting intent for channel ${channelId}`);

		const channel = this.activeChannels.get(channelId);
		if (!channel) throw new Error("Channel not found");

		const intentId = ethers.keccak256(
			ethers.solidityPacked(["bytes32", "uint256"], [channelId, Date.now()]),
		);

		// ✅ Get REAL LI.FI quote
		let quote = null;
		try {
			console.log("🔍 Requesting LI.FI quote...");

			// Convert amount to wei for LI.FI
			const amountWei = ethers.parseUnits(intent.amountIn.toString(), 6); // USDC has 6 decimals

			quote = await this.lifi.getQuote(
				SEPOLIA_CHAIN_ID, // From Sepolia
				101, // To Sui Testnet (or use 784 for Sui mainnet)
				YTEST_TOKEN, // From USDC
				"0x0000000000000000000000000000000000000000", // Native SUI (use 0x0 for native tokens)
				amountWei.toString(),
				this.wallet.address,
			);

			if (quote && !quote.isMock) {
				console.log("✅ Real LI.FI quote received");
			} else {
				console.log("⚠️ Using mock quote (LI.FI unavailable)");
			}
		} catch (error) {
			console.error("⚠️ LI.FI quote failed, using mock:", error.message);
			quote = this.lifi.mockQuote(intent.amountIn);
		}

		const intentData = {
			intentId,
			channelId,
			trader: this.wallet.address,
			traderENS: channel.ensName,
			tokenIn: intent.tokenIn || YTEST_TOKEN,
			tokenOut: intent.tokenOut,
			amountIn: intent.amountIn,
			minAmountOut: intent.minAmountOut,
			deadline: Date.now() + 300000, // 5 minutes
			status: "pending",
			createdAt: Date.now(),
			lifiQuote: quote, // Store LI.FI quote (real or mock)
		};

		this.pendingIntents.set(intentId, intentData);

		// Broadcast to solvers via WebSocket if connected
		if (this.isConnected()) {
			const message = {
				type: "new_intent",
				data: intentData,
			};
			this.ws.send(JSON.stringify(message));
			console.log("✅ Intent broadcasted to solvers");
		} else {
			console.log("⚠️ WebSocket not connected, intent stored locally");
		}

		console.log("✅ Intent created with LI.FI quote data");
		return intentData;
	}

	/**
	 * Calculate dynamic fee based on trader's volume (Uniswap v4 hook style)
	 */
	async getDynamicFee(trader) {
		try {
			// Get trader's fulfilled intents
			const traderIntents = Array.from(this.pendingIntents.values()).filter(
				(i) => i.trader === trader && i.status === "fulfilled",
			);

			// Calculate total volume
			const totalVolume = traderIntents.reduce(
				(sum, intent) => sum + intent.amountIn,
				0,
			);

			// Fee calculation logic (Uniswap v4 dynamic fee hook simulation)
			const BASE_FEE = 3000; // 0.30% in basis points
			const MIN_FEE = 1000; // 0.10% minimum
			const VOLUME_THRESHOLD = 100; // 100 USDC per tier

			// Every 100 USDC traded reduces fee by 0.05% (500 basis points)
			const volumeMultiplier = Math.floor(totalVolume / VOLUME_THRESHOLD);
			const feeReduction = volumeMultiplier * 500;

			let feeBasisPoints = BASE_FEE - feeReduction;
			if (feeBasisPoints < MIN_FEE) {
				feeBasisPoints = MIN_FEE; // Floor at 0.10%
			}

			const feePercent = (feeBasisPoints / 100).toFixed(2);
			const savings = Math.max(0, BASE_FEE - feeBasisPoints);

			console.log(
				`📊 Dynamic Fee for ${trader.slice(0, 6)}...${trader.slice(-4)}:`,
			);
			console.log(`  Current Fee: ${feePercent}%`);
			console.log(`  Total Volume: ${totalVolume} USDC`);
			console.log(`  Savings: ${savings} basis points vs base fee`);
			console.log(`  Fulfilled Swaps: ${traderIntents.length}`);

			return {
				fee: feePercent,
				feeBasisPoints,
				volume: totalVolume.toString(),
				savings,
				baseFee: "0.30",
				minFee: "0.10",
				swapCount: traderIntents.length,
			};
		} catch (error) {
			console.error("❌ Error calculating dynamic fee:", error.message);
			// Fallback to base fee
			return {
				fee: "0.30",
				feeBasisPoints: 3000,
				volume: "0",
				savings: 0,
				baseFee: "0.30",
				minFee: "0.10",
				swapCount: 0,
			};
		}
	}

	/**
	 * Handle intent fulfilled event
	 */
	async handleIntentFulfilled(data) {
		console.log("✅ Intent fulfilled:", data.intentId);
		const intent = this.pendingIntents.get(data.intentId);
		if (intent) {
			intent.status = "fulfilled";
			intent.amountOut = data.amountOut;
			intent.fulfilledAt = Date.now();
			this.pendingIntents.set(data.intentId, intent);
		}
	}

	/**
	 * Handle solver quote event
	 */
	async handleSolverQuote(data) {
		console.log("💰 Solver quote received:", data);
	}

	/**
	 * Get all active channels
	 */
	getAllChannels() {
		return Array.from(this.activeChannels.values());
	}

	/**
	 * Get all intents
	 */
	getAllIntents() {
		return Array.from(this.pendingIntents.values());
	}

	/**
	 * Check if WebSocket is connected
	 */
	isConnected() {
		return this.ws && this.ws.readyState === WebSocket.OPEN;
	}
}

export { ChannelManager };
