const clearNodeService = require("../services/clearnode.service");

router.post("/", async (req, res) => {
	const { channelId, sellToken, sellAmount, buyToken, minBuyAmount } = req.body;

	// Create intent object
	const intent = {
		id: `intent_${Date.now()}`,
		channelId,
		sellToken,
		sellAmount: parseFloat(sellAmount),
		buyToken,
		minBuyAmount: parseFloat(minBuyAmount),
		timestamp: new Date().toISOString(),
		status: "pending",
	};

	console.log("\n📨 NEW INTENT RECEIVED:", intent.id);

	try {
		// Step 1: Broadcast to solver network
		await clearNodeService.broadcastIntent(intent);

		// Step 2: Wait for solver bids (5 second auction window)
		console.log("⏳ Waiting for solver bids (5s auction)...");
		const bids = await clearNodeService.listenForSolverBids(intent.id, 5000);

		console.log(`📊 Received ${bids.length} solver bids`);

		// Step 3: Select best bid (highest output, fastest time)
		const bestBid =
			bids.length > 0
				? bids.sort(
						(a, b) =>
							parseFloat(b.estimatedOutput) - parseFloat(a.estimatedOutput),
					)[0]
				: null;

		if (bestBid) {
			console.log("🏆 Best solver:", bestBid.solver);
			console.log("📍 Route:", bestBid.route);

			// Step 4: Execute via winning solver's route
			const quote = await lifiService.getQuote({
				fromChain: "ETH",
				toChain: "SUI",
				fromToken: sellToken,
				toToken: buyToken,
				fromAmount: sellAmount,
			});

			intent.solverWinner = bestBid.solver;
			intent.executionRoute = bestBid.route;
			intent.estimatedOutput = quote.estimate.toAmount;
		} else {
			// Fallback to direct LI.FI quote
			console.log("⚠️ No solver bids, using direct LI.FI route");
			const quote = await lifiService.getQuote({
				fromChain: "ETH",
				toChain: "SUI",
				fromToken: sellToken,
				toToken: buyToken,
				fromAmount: sellAmount,
			});
			intent.estimatedOutput = quote.estimate.toAmount;
		}

		// Step 5: Mock execution (for demo)
		setTimeout(() => {
			intent.status = "fulfilled";
			intent.actualOutput = intent.estimatedOutput;
			console.log("✅ INTENT FULFILLED:", intent.id);
		}, 3000);

		res.json({
			success: true,
			intent,
			solverBids: bids.length,
			bestRoute: bestBid?.route || "Direct LI.FI",
		});
	} catch (error) {
		console.error("❌ Intent execution failed:", error);
		res.status(500).json({ error: error.message });
	}
});
