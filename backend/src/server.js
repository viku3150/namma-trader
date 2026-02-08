import express from "express";
import cors from "cors";
import { ChannelManager } from "./channelManager.js";
import { ClearNodeService } from "../services/clearnode.service.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const manager = new ChannelManager(
	process.env.PRIVATE_KEY,
	process.env.SEPOLIA_RPC_URL,
);

// Initialize ClearNode service (Day 4 addition)
const clearNode = new ClearNodeService();

// Initialize connection
manager
	.connect()
	.then(async () => {
		console.log("🚀 Channel manager ready");

		await clearNode.connect(
			process.env.CHANNEL_ID || "demo-channel-namma",
			process.env.PRIVATE_KEY,
		);
	})
	.catch((error) => {
		console.error("❌ Failed to connect:", error);
		process.exit(1);
	});

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
	res.json({
		status: "ok",
		connected: manager.isConnected(),
		clearNodeConnected: clearNode.isConnected(), // Day 4: Add relay status
		wallet: manager.wallet.address,
		timestamp: Date.now(),
	});
});

/**
 * Create a new state channel
 */
app.post("/api/channel/create", async (req, res) => {
	try {
		const { depositAmount } = req.body;
		const channel = await manager.createChannel(depositAmount);
		res.json({ success: true, channel });
	} catch (error) {
		console.error("Error creating channel:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * Deposit to an existing channel
 */
app.post("/api/channel/deposit", async (req, res) => {
	try {
		const { channelId, amount } = req.body;
		const txHash = await manager.depositToChannel(channelId, amount);
		res.json({ success: true, txHash });
	} catch (error) {
		console.error("Error depositing:", error);
		res.status(500).json({ error: error.message });
	}
});

/**
 * Get channel balance
 */
app.get("/api/channel/:id/balance", async (req, res) => {
	try {
		const channelId = req.params.id;
		const channel = manager.activeChannels.get(channelId);

		if (!channel) {
			return res.status(404).json({ error: "Channel not found" });
		}

		// ✅ Return simple, consistent format
		const balanceValue = parseFloat(channel.balance) || 0;

		res.json({
			balance: balanceValue.toString(), // Simple string
			available: balanceValue.toString(),
			locked: "0",
			total: balanceValue.toString(),
			channelId: channelId,
			status: channel.status || "active",
		});
	} catch (error) {
		console.error("Error getting balance:", error);
		res.status(500).json({ error: error.message });
	}
});


/**
 * Submit a trading intent
 */
app.post("/api/intent/submit", async (req, res) => {
    try {
        const { channelId, intent } = req.body;

        if (!channelId || !intent) {
            return res
                .status(400)
                .json({ error: "Missing channelId or intent data" });
        }

        const intentData = await manager.submitIntent(channelId, intent);

        // Return intent with route details
        res.json({
            success: true,
            intent: {
                ...intentData,
                route: intentData.lifiQuote ? {
                    bridges: intentData.lifiQuote.bridges,
                    steps: intentData.lifiQuote.steps,
                    totalSteps: intentData.lifiQuote.totalSteps,
                    estimatedTime: intentData.lifiQuote.estimatedTime,
                    estimatedOutput: intentData.lifiQuote.outputFormatted,
                    isMock: intentData.lifiQuote.isMock,
                } : null
            },
        });

        // ✅ IMPORTANT: Only process ONCE, after a delay
        setTimeout(() => {
            processIntentLocally(intentData);
        }, 100);
        
    } catch (error) {
        console.error("Error submitting intent:", error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * Get all intents
 */
app.get("/api/intents", (req, res) => {
	const intents = manager.getAllIntents();
	res.json({ intents });
});

/**
 * Get all channels
 */
app.get("/api/channels", (req, res) => {
	const channels = manager.getAllChannels();
	res.json({ channels });
});

/**
 * Resolve ENS name or get ENS for address
 */
app.get("/api/ens/:nameOrAddress", async (req, res) => {
	try {
		const resolved = await manager.resolveENS(req.params.nameOrAddress);
		res.json({ resolved });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * Get dynamic fee for a trader (Uniswap v4 style)
 */
app.get("/api/fee/:address", async (req, res) => {
	try {
		const feeInfo = await manager.getDynamicFee(req.params.address);
		res.json({ success: true, feeInfo });
	} catch (error) {
		console.error("Error getting fee:", error);
		res.status(500).json({ error: error.message });
	}
});

app.get("/api/ens/:nameOrAddress", async (req, res) => {
	const { nameOrAddress } = req.params;

	try {
		let result;

		if (nameOrAddress.endsWith(".eth")) {
			// Forward lookup: name → address
			result = await ensService.resolveAddress(nameOrAddress);
			if (result) {
				result.avatar = await ensService.getAvatar(nameOrAddress);
			}
		} else if (nameOrAddress.startsWith("0x")) {
			// Reverse lookup: address → name
			const name = await ensService.reverseLookup(nameOrAddress);
			result = name
				? {
						name,
						address: nameOrAddress,
						avatar: await ensService.getAvatar(name),
					}
				: null;
		}

		if (!result) {
			return res.json({
				resolved: false,
				message: "ENS not found (testnets have limited ENS support)",
			});
		}

		res.json({ resolved: true, ...result });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

/**
 * Close and settle channel on-chain
 */
app.post("/api/channel/:id/close", async (req, res) => {
	try {
		const channelId = req.params.id;

		// Debug logging
		console.log("\n🔍 ATTEMPTING TO CLOSE CHANNEL");
		console.log("Requested Channel ID:", channelId);
		console.log("Available Channels:", manager.activeChannels.size); // ✅ Changed to activeChannels

		// ✅ Use activeChannels instead of channels
		const channel = manager.activeChannels.get(channelId);

		if (!channel) {
			console.error("❌ Channel not found!");
			console.error("Tried to find:", channelId);
			console.error("Available channels:", manager.activeChannels.size);

			return res.status(404).json({
				error: "Channel not found",
				requestedId: channelId,
				availableChannels: Array.from(manager.activeChannels.keys()).map(
					(id) => id.slice(0, 16) + "...",
				),
			});
		}

		if (channel.status === "closed") {
			return res.status(400).json({
				error: "Channel already closed",
				settlementTx: channel.settlementTx,
			});
		}

		console.log("=".repeat(60));
		console.log("🔒 CLOSING CHANNEL");
		console.log("=".repeat(60));
		console.log("Channel ID:", channelId.slice(0, 16) + "...");
		console.log("Owner:", channel.address);
		console.log("ENS Name:", channel.ensName || "None");
		console.log("Final Balance:", channel.balance, "USDC");
		console.log("Created At:", new Date(channel.createdAt).toLocaleString());

		// Calculate session stats
		const sessionDuration = Math.floor((Date.now() - channel.createdAt) / 1000);
		const intentsArray = Array.from(manager.pendingIntents.values());
		const channelIntents = intentsArray.filter(
			(i) => i.channelId === channelId && i.status === "fulfilled",
		);
		const intentsExecuted = channelIntents.length;

		console.log("\n📊 SESSION STATISTICS:");
		console.log("Duration:", sessionDuration, "seconds");
		console.log("Intents Fulfilled:", intentsExecuted);
		if (intentsExecuted > 0) {
			console.log(
				"Avg Time per Intent:",
				(sessionDuration / intentsExecuted).toFixed(1),
				"seconds",
			);
		}

		// Simulate settlement transaction
		const settlementTx = {
			hash: "0x" + Math.random().toString(16).substring(2, 66),
			blockNumber: 6234567 + Math.floor(Math.random() * 1000),
			timestamp: Date.now(),
			finalBalance: channel.balance,
			withdrawnAmount: channel.balance,
			gasUsed: "21000",
			gasCost: "$0.00",
			status: "success",
		};

		// Update channel state
		channel.status = "closed";
		channel.closedAt = Date.now();
		channel.settlementTx = settlementTx.hash;
		channel.finalBalance = channel.balance;
		channel.withdrawnAmount = settlementTx.withdrawnAmount;

		// ✅ Update the Map with modified channel
		manager.activeChannels.set(channelId, channel);

		console.log("\n⚡ SETTLEMENT TRANSACTION:");
		console.log("Tx Hash:", settlementTx.hash);
		console.log("Block Number:", settlementTx.blockNumber);
		console.log("Withdrawn Amount:", settlementTx.withdrawnAmount, "USDC");
		console.log(
			"Gas Cost:",
			settlementTx.gasCost,
			"(sponsored by state channel)",
		);
		console.log("Status:", settlementTx.status.toUpperCase());

		console.log("\n✅ CHANNEL CLOSED SUCCESSFULLY");
		console.log(
			"User Balance Updated: +",
			settlementTx.withdrawnAmount,
			"USDC",
		);
		console.log("=".repeat(60) + "\n");

		res.json({
			success: true,
			channelId,
			status: "closed",
			settlementTx: settlementTx.hash,
			blockNumber: settlementTx.blockNumber,
			finalBalance: channel.balance,
			withdrawnAmount: settlementTx.withdrawnAmount,
			sessionDuration,
			intentsExecuted,
			message: `Channel closed. ${settlementTx.withdrawnAmount} USDC withdrawn to wallet.`,
		});
	} catch (error) {
		console.error("❌ Error closing channel:", error);
		res.status(500).json({
			error: error.message,
			stack: error.stack,
		});
	}
});

/**
 * Get channel info (including closed status)
 */
app.get("/api/channel/:id", (req, res) => {
	const channel = manager.activeChannels.get(req.params.id); // ✅ Use activeChannels

	if (!channel) {
		return res.status(404).json({ error: "Channel not found" });
	}

	res.json({
		channelId: channel.channelId,
		address: channel.address,
		ensName: channel.ensName,
		status: channel.status || "active",
		balance: channel.balance,
		createdAt: channel.createdAt,
		closedAt: channel.closedAt,
		settlementTx: channel.settlementTx,
		withdrawnAmount: channel.withdrawnAmount,
	});
});

/**
 * Select best solver from auction bids
 * Criteria: Highest output, fastest execution time
 */
function selectBestSolver(bids) {
	if (bids.length === 0) return null;

	return bids.sort((a, b) => {
		// Primary: Sort by estimated output (higher is better)
		const outputDiff =
			parseFloat(b.estimatedOutput) - parseFloat(a.estimatedOutput);
		if (outputDiff !== 0) return outputDiff;

		// Secondary: Sort by execution time (lower is better)
		return parseFloat(a.executionTime) - parseFloat(b.executionTime);
	})[0];
}

// ============================================
// LOCAL SOLVER PROCESSING (Enhanced for Day 4)
// ============================================

/**
 * Process intent locally with integrated solver
 * Includes LI.FI integration and mock execution
 */
async function processIntentLocally(intent) {
	console.log("\n" + "=".repeat(60));
	console.log("📨 NEW INTENT RECEIVED");
	console.log("=".repeat(60));
	console.log("Intent ID:", intent.intentId.slice(0, 16) + "...");
	console.log("Trader:", intent.traderENS || intent.trader);
	console.log("Channel:", intent.channelId.slice(0, 10) + "...");
	console.log(
		"Swap:",
		`${intent.amountIn} ${intent.tokenIn || "USDC"} → ${intent.tokenOut}`,
	);
	console.log("Min Output:", intent.minAmountOut, intent.tokenOut);

	// Get channel and check balance
	const channel = manager.activeChannels.get(intent.channelId);
	if (!channel) {
		console.log("❌ Channel not found for intent");
		return;
	}

	const currentBalance = parseFloat(channel.balance);
	const swapAmount = parseFloat(intent.amountIn);

	console.log("\n💰 CHANNEL BALANCE CHECK:");
	console.log("Current Balance:", currentBalance, "USDC");
	console.log("Swap Amount:", swapAmount, "USDC");

	// Check if sufficient balance
	if (currentBalance < swapAmount) {
		console.log("❌ INSUFFICIENT BALANCE!");
		console.log("Required:", swapAmount, "USDC");
		console.log("Available:", currentBalance, "USDC");

		const storedIntent = manager.pendingIntents.get(intent.intentId);
		if (storedIntent) {
			storedIntent.status = "failed";
			storedIntent.failureReason = "Insufficient balance in channel";
			manager.pendingIntents.set(intent.intentId, storedIntent);
		}
		return;
	}

	let estimatedOutput;
	let route;
	let routeDetails = null;

	if (intent.lifiQuote) {
		const quote = intent.lifiQuote;

		if (!quote.isMock) {
			console.log("\n🌉 USING REAL LI.FI ROUTE:");
		} else {
			console.log("\n🔧 USING MOCK ROUTE (LI.FI simulation):");
		}

		console.log(
			"Steps:",
			quote.totalSteps || (quote.steps ? quote.steps.length : "N/A"),
		);
		console.log(
			"Route:",
			quote.bridges ? quote.bridges.join(" → ") : "No route info",
		);

		// Show steps if they exist
		if (quote.steps && Array.isArray(quote.steps) && quote.steps.length > 0) {
			quote.steps.forEach((step, idx) => {
				const protocol = step.protocol || step.tool || "Unknown";
				const action = step.action || "transfer";
				const from = step.fromChain || "Chain A";
				const to = step.toChain || "Chain B";
				console.log(`   ${idx + 1}. ${protocol} (${action}): ${from} → ${to}`);
			});
		}

		// Format output (might be wei, convert if needed)
		let outputDisplay = quote.outputFormatted || quote.estimatedOutput;
		if (outputDisplay && outputDisplay.toString().length > 10) {
			// Probably in wei, format it
			outputDisplay = (parseFloat(outputDisplay) / 1000000).toFixed(2);
		}
		console.log("Estimated Output:", outputDisplay, intent.tokenOut);
		console.log("Estimated Time:", quote.estimatedTime || "N/A", "seconds");

		// Handle gasEstimate safely
		if (quote.gasEstimate !== undefined && quote.gasEstimate !== null) {
			const gasDisplay =
				typeof quote.gasEstimate === "number"
					? quote.gasEstimate.toFixed(2)
					: quote.gasEstimate;
			console.log("Gas Estimate: $", gasDisplay);
		}

		// Parse output for comparison
		estimatedOutput =
			parseFloat(outputDisplay) || parseFloat(quote.estimatedOutput) || 0;
		route = quote.bridges ? quote.bridges.join(" → ") : "LI.FI Route";
		routeDetails = quote.steps || null;
	} else {
		// Fallback if no quote at all
		console.log("\n⚠️ NO LI.FI QUOTE - Using simple estimate");
		const mockRate = 0.95;
		estimatedOutput = intent.amountIn * mockRate;
		route = "Direct: USDC → " + intent.tokenOut;
	}

	if (estimatedOutput >= intent.minAmountOut) {
		console.log("✅ Quote meets minimum requirement");
		console.log("\n⏳ Executing in 3 seconds...");

		setTimeout(() => {
			console.log("\n⚡ EXECUTING INTENT...");
			console.log("Route:", route);
			console.log(
				"Bridge Protocol:",
				intent.lifiQuote?.isMock
					? "Mock (LI.FI Simulation)"
					: "Real LI.FI Route",
			);
			console.log("Gas Cost: $0 (gasless via state channel)");

			// Deduct swap amount from channel balance
			const newBalance = currentBalance - swapAmount;
			channel.balance = newBalance;
			manager.activeChannels.set(intent.channelId, channel);

			console.log("\n💰 BALANCE UPDATED:");
			console.log("Previous Balance:", currentBalance, "USDC");
			console.log("Swap Amount:", swapAmount, "USDC");
			console.log("New Balance:", newBalance.toFixed(2), "USDC");

			// Update intent status
			const storedIntent = manager.pendingIntents.get(intent.intentId);
			if (storedIntent) {
				storedIntent.status = "fulfilled";
				storedIntent.amountOut = estimatedOutput.toFixed(2);
				storedIntent.fulfilledAt = Date.now();
				storedIntent.executionRoute = route;
				storedIntent.routeDetails = routeDetails;
				storedIntent.routeSteps =
					intent.lifiQuote?.totalSteps || intent.lifiQuote?.steps?.length || 1;
				storedIntent.winningSolver = "lifi";
				manager.pendingIntents.set(intent.intentId, storedIntent);

				console.log("\n✅ INTENT FULFILLED!");
				console.log("Amount Out:", estimatedOutput.toFixed(2), intent.tokenOut);
				console.log(
					"Transaction Hash:",
					"0x" + Math.random().toString(16).substring(2, 66),
				);
				console.log("=".repeat(60) + "\n");
			}
		}, 3000);
	} else {
		console.log("❌ Quote below minimum - Intent rejected");
		console.log("Required:", intent.minAmountOut, intent.tokenOut);
		console.log("Offered:", estimatedOutput.toFixed(2), intent.tokenOut);
		console.log("=".repeat(60) + "\n");

		const storedIntent = manager.pendingIntents.get(intent.intentId);
		if (storedIntent) {
			storedIntent.status = "failed";
			storedIntent.failureReason = "Quote below minimum acceptable output";
			manager.pendingIntents.set(intent.intentId, storedIntent);
		}
	}
}

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
	console.log(`🎧 Server running on http://localhost:${PORT}`);
	console.log("📊 Integrated solver ready to process intents");
	console.log("🌐 API Endpoints:");
	console.log("  GET  /api/health");
	console.log("  POST /api/channel/create");
	console.log("  POST /api/channel/deposit");
	console.log("  GET  /api/channel/:id/balance");
	console.log("  POST /api/intent/submit");
	console.log("  GET  /api/intents");
	console.log("  GET  /api/channels");
	console.log("  GET  /api/ens/:nameOrAddress");
	console.log("  GET  /api/fee/:address");
	console.log("");
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on("SIGINT", () => {
	console.log("\n👋 Shutting down gracefully...");
	clearNode.disconnect();
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n👋 Shutting down gracefully...");
	clearNode.disconnect();
	process.exit(0);
});
