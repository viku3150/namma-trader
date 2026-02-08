import { createConfig, getRoutes } from "@lifi/sdk";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

export class LiFiService {
	constructor() {
		const apiKey = process.env.LIFI_API_KEY;

		console.log(
			"🔑 LI.FI API Key:",
			apiKey
				? `${apiKey.slice(0, 10)}... (${apiKey.length} chars)`
				: "❌ NOT FOUND",
		);

		// ✅ NEW: Configure LI.FI SDK v3
		this.config = createConfig({
			integrator: "namma-global-trader",
			apiKey: apiKey,
		});

		const hasApiKey = !!apiKey;
		console.log(
			`✅ LI.FI SDK initialized ${hasApiKey ? "WITH API KEY ✅" : "WITHOUT API KEY ⚠️"}`,
		);

		if (!hasApiKey) {
			console.log(
				"💡 Add LIFI_API_KEY to your .env file for better performance",
			);
		}
	}

	/**
	 * Get real cross-chain quote
	 */
	async getQuote(
		fromChainId,
		toChainId,
		fromToken,
		toToken,
		amount,
		fromAddress,
	) {
		try {
			console.log("\n🔍 LI.FI: Requesting cross-chain quote...");
			console.log(
				`   From: ${this.getChainName(fromChainId)} → To: ${this.getChainName(toChainId)}`,
			);
			console.log(`   Amount: ${ethers.formatUnits(amount, 6)} USDC`);

			// Try Base Sepolia (most likely to work on testnet)
			const routesRequest = {
				fromChainId: Number(fromChainId),
				toChainId: 84532, // Base Sepolia
				fromTokenAddress: fromToken,
				toTokenAddress: "0x0000000000000000000000000000000000000000",
				fromAmount: amount.toString(),
				fromAddress,
				options: {
					order: "RECOMMENDED",
					slippage: 0.05,
					allowSwitchChain: false,
				},
			};

			// ✅ Use getRoutes function directly
			const result = await getRoutes(routesRequest);

			if (!result || !result.routes || result.routes.length === 0) {
				console.log("   ⚠️ No routes found, using mock");
				return this.mockQuote(amount, fromChainId, toChainId);
			}

			const bestRoute = result.routes[0];
			const steps = bestRoute.steps.map((step) => ({
				tool: step.tool,
				action:
					step.action.fromChain === step.action.toChain ? "swap" : "bridge",
				fromChain: this.getChainName(step.action.fromChainId),
				toChain: this.getChainName(step.action.toChainId),
				protocol: step.toolDetails?.name || step.tool,
			}));

			console.log("   ✅ REAL LI.FI route received!");
			console.log("   Route:", steps.map((s) => s.protocol).join(" → "));

			return {
				estimatedOutput: bestRoute.toAmount,
				outputFormatted: ethers.formatUnits(bestRoute.toAmount, 6),
				bridges: steps.map((s) => s.protocol),
				steps: steps,
				estimatedTime: bestRoute.steps.reduce(
					(sum, s) => sum + (s.estimate?.executionDuration || 60),
					0,
				),
				gasEstimate:
					bestRoute.gasCosts?.reduce(
						(sum, cost) => sum + parseFloat(cost.amountUSD || 0),
						0,
					) || 0,
				isMock: false,
				totalSteps: steps.length,
			};
		} catch (error) {
			console.error("   ❌ LI.FI error:", error.message);
			return this.mockQuote(amount, fromChainId, toChainId);
		}
	}

	mockQuote(amount, fromChainId, toChainId) {
		const amountNum = parseFloat(ethers.formatUnits(amount.toString(), 6));
		const mockRate = 0.97;
		const outputAmount = amountNum * mockRate;

		const steps = [
			{
				tool: "uniswap-v3",
				action: "swap",
				fromChain: this.getChainName(fromChainId),
				toChain: this.getChainName(fromChainId),
				protocol: "Uniswap V3",
			},
			{
				tool: "across",
				action: "bridge",
				fromChain: this.getChainName(fromChainId),
				toChain: "Base Sepolia",
				protocol: "Across Protocol",
			},
			{
				tool: "pancakeswap",
				action: "swap",
				fromChain: "Base Sepolia",
				toChain: "Base Sepolia",
				protocol: "PancakeSwap",
			},
		];

		console.log("   📊 Mock route:", steps.map((s) => s.protocol).join(" → "));

		return {
			estimatedOutput: ethers.parseUnits(outputAmount.toFixed(6), 6).toString(),
			outputFormatted: outputAmount.toFixed(2),
			bridges: steps.map((s) => s.protocol),
			steps: steps,
			estimatedTime: 180,
			gasEstimate: 0,
			isMock: true,
			totalSteps: steps.length,
		};
	}

	getChainName(chainId) {
		const chains = {
			1: "Ethereum",
			10: "Optimism",
			137: "Polygon",
			8453: "Base",
			11155111: "Sepolia",
			84532: "Base Sepolia",
		};
		return chains[chainId] || `Chain ${chainId}`;
	}
}
