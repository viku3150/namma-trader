import WebSocket from "ws";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const CLEARNODE_WS = "wss://clearnet.yellow.com/ws";
const SOLVER_NAME = "Namma Solver v1";

class IntentSolver {
	constructor() {
		this.ws = null;
		this.pendingIntents = new Map();
		console.log(`🤖 ${SOLVER_NAME} initializing...`);
	}

	async connect() {
		console.log("🔌 Connecting to intent network...");

		this.ws = new WebSocket(CLEARNODE_WS);

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				console.log("⚠️  Connection timeout, running in local mode");
				resolve();
			}, 5000);

			this.ws.on("open", () => {
				clearTimeout(timeout);
				console.log("✅ Connected to intent network");
				this.setupMessageHandlers();
				resolve();
			});

			this.ws.on("error", (error) => {
				clearTimeout(timeout);
				console.log("⚠️  WebSocket error, running in local mode");
				resolve();
			});

			this.ws.on("close", () => {
				console.log("🔌 Disconnected from intent network");
			});
		});
	}

	setupMessageHandlers() {
		this.ws.on("message", async (data) => {
			try {
				const message = JSON.parse(data.toString());

				switch (message.type) {
					case "new_intent":
						await this.handleNewIntent(message.data);
						break;
					default:
						console.log("⚠️  Unknown message type:", message.type);
				}
			} catch (error) {
				console.error("❌ Error processing message:", error);
			}
		});
	}

	async handleNewIntent(intent) {
		console.log("\n📨 New Intent Received!");
		console.log("Intent ID:", intent.intentId);
		console.log("Trader:", intent.traderENS || intent.trader);
		console.log("Swap:", `${intent.amountIn} USDC → ${intent.tokenOut}`);
		console.log("Min out:", intent.minAmountOut);

		// Store intent
		this.pendingIntents.set(intent.intentId, intent);

		// Simulate solving (mock)
		await this.solveIntent(intent);
	}

	async solveIntent(intent) {
		console.log("\n🔧 Solving intent:", intent.intentId.slice(0, 10) + "...");

		// Simulate quote calculation
		const mockRate = 0.95; // 95% of input (5% slippage simulation)
		const estimatedOutput = intent.amountIn * mockRate;

		console.log("📊 Mock Quote:");
		console.log(`  Rate: ${mockRate} ${intent.tokenOut}/USDC`);
		console.log(`  Estimated output: ${estimatedOutput} ${intent.tokenOut}`);

		// Check if quote meets minimum
		if (estimatedOutput >= intent.minAmountOut) {
			console.log("✅ Quote meets minimum, sending to trader...");

			// Send quote back
			const quote = {
				type: "solver_quote",
				data: {
					intentId: intent.intentId,
					solver: SOLVER_NAME,
					amountOut: estimatedOutput.toString(),
					route: "Mock Route: USDC → Uniswap → LI.FI → SUI",
					estimatedTime: "15s",
					gasEstimate: "0 (gasless)",
				},
			};

			if (this.isConnected()) {
				this.ws.send(JSON.stringify(quote));
				console.log("✅ Quote sent to trader");
			}

			// Simulate execution after 3 seconds
			setTimeout(() => {
				this.executeIntent(intent, estimatedOutput);
			}, 3000);
		} else {
			console.log("❌ Quote does not meet minimum output");
		}
	}

	async executeIntent(intent, amountOut) {
		console.log("\n⚡ Executing intent:", intent.intentId.slice(0, 10) + "...");
		console.log(
			`  Swap: ${intent.amountIn} USDC → ${amountOut} ${intent.tokenOut}`,
		);

		// In real implementation:
		// 1. Call LI.FI SDK for cross-chain route
		// 2. Execute swap through Uniswap v4
		// 3. Update channel state
		// 4. Settle on-chain if needed

		// Mock execution
		const fulfillment = {
			type: "intent_fulfilled",
			data: {
				intentId: intent.intentId,
				amountOut: amountOut.toString(),
				executedAt: Date.now(),
				txHash: ethers.keccak256(ethers.toUtf8Bytes(`mock-tx-${Date.now()}`)),
			},
		};

		if (this.isConnected()) {
			this.ws.send(JSON.stringify(fulfillment));
			console.log("✅ Intent fulfilled, notification sent");
		}

		// Update local state
		const storedIntent = this.pendingIntents.get(intent.intentId);
		if (storedIntent) {
			storedIntent.status = "fulfilled";
			storedIntent.amountOut = amountOut;
			this.pendingIntents.set(intent.intentId, storedIntent);
		}

		console.log("🎉 Intent execution complete!\n");
	}

	isConnected() {
		return this.ws && this.ws.readyState === WebSocket.OPEN;
	}

	getStats() {
		const intents = Array.from(this.pendingIntents.values());
		return {
			total: intents.length,
			pending: intents.filter((i) => i.status === "pending").length,
			fulfilled: intents.filter((i) => i.status === "fulfilled").length,
		};
	}
}

// Start solver
const solver = new IntentSolver();
solver.connect().then(() => {
	console.log("🚀 Solver is ready and listening for intents...\n");

	// Log stats every 30 seconds
	setInterval(() => {
		const stats = solver.getStats();
		console.log(
			`📊 Stats - Total: ${stats.total}, Pending: ${stats.pending}, Fulfilled: ${stats.fulfilled}`,
		);
	}, 30000);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
	console.log("\n👋 Shutting down solver...");
	process.exit(0);
});
