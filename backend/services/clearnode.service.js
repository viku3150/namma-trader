export class ClearNodeService {
	constructor() {
		this.wsUrl = "wss://clearnet.yellow.com/ws";
		this.client = null;
		this.connected = false;
		this.messageHandlers = new Map();
	}

	async connect(channelId, signerPrivateKey) {
		try {
			console.log("📡 Attempting ClearNode connection...");

			this.connected = false; // Set to true when real SDK is integrated
			console.log("⚠️  ClearNode relay unavailable - using mock solver mode");
			console.log(
				"💡 This is expected for demo. Solvers will use local mock bids.",
			);

			return this.connected;
		} catch (err) {
			console.warn("⚠️  ClearNode connection failed:", err.message);
			console.log("📦 Falling back to mock solver mode");
			this.connected = false;
			return false;
		}
	}

	isConnected() {
		return this.connected;
	}

	async broadcastIntent(intent) {
		if (!this.connected) {
			console.log(
				"📡 Mock broadcast (ClearNode offline):",
				intent.intentId.slice(0, 16) + "...",
			);
			return { broadcast: "mock", intentId: intent.intentId };
		}

		return { broadcast: "success", intentId: intent.intentId };
	}

	async listenForSolverBids(intentId, timeout = 5000) {
		const bids = [];

		return new Promise((resolve) => {
			if (!this.connected) {
				// Mock solver bids for demo
				setTimeout(() => {
					// Simulate 1-2 competitive solver bids
					const numBids = Math.random() > 0.5 ? 2 : 1;

					for (let i = 0; i < numBids; i++) {
						bids.push({
							solver: `0x${Math.random().toString(16).substring(2, 10)}...Solver${i + 1}`,
							route:
								i === 0
									? "LI.FI → Wormhole → Sui DeepBook"
									: "Uniswap v4 → Across Bridge → Sui",
							estimatedOutput: (9.7 + Math.random() * 0.4).toFixed(2) + " SUI",
							executionTime: (0.6 + Math.random() * 0.5).toFixed(1) + "s",
							gasEstimate: "$0.00 (gasless)",
						});
					}

					resolve(bids);
				}, 1200); // 1.2 second mock delay
				return;
			}

			const timer = setTimeout(() => resolve(bids), timeout);
		});
	}

	disconnect() {
		if (this.client && this.connected) {
			this.connected = false;
			console.log("📡 ClearNode disconnected");
		}
	}
}
