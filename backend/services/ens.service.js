const { createPublicClient, http } = require("viem");
const { mainnet, sepolia } = require("viem/chains");
const { normalize } = require("viem/ens");

class ENSService {
	constructor() {
		// Try mainnet first for real ENS, fallback to Sepolia
		this.mainnetClient = createPublicClient({
			chain: mainnet,
			transport: http("https://eth-mainnet.g.alchemy.com/v2/demo"),
		});

		this.sepoliaClient = createPublicClient({
			chain: sepolia,
			transport: http("https://eth-sepolia.g.alchemy.com/v2/demo"),
		});
	}

	async resolveAddress(ensName) {
		try {
			// Try mainnet first
			const address = await this.mainnetClient.getEnsAddress({
				name: normalize(ensName),
			});

			if (address) {
				return { address, network: "mainnet", name: ensName };
			}

			// Fallback to Sepolia (limited support) [web:27]
			console.log("⚠️ ENS not on mainnet, trying Sepolia...");
			const sepoliaAddr = await this.sepoliaClient.getEnsAddress({
				name: normalize(ensName),
			});

			return sepoliaAddr
				? { address: sepoliaAddr, network: "sepolia", name: ensName }
				: null;
		} catch (error) {
			console.warn(`⚠️ ENS resolution failed for ${ensName}:`, error.message);
			return null;
		}
	}

	async reverseLookup(address) {
		try {
			const ensName = await this.mainnetClient.getEnsName({ address });
			return ensName || null;
		} catch (error) {
			console.warn(`⚠️ Reverse ENS lookup failed for ${address}`);
			return null;
		}
	}

	async getAvatar(ensName) {
		try {
			const avatar = await this.mainnetClient.getEnsAvatar({
				name: normalize(ensName),
			});
			return avatar;
		} catch (error) {
			return null; // No avatar set
		}
	}
}

module.exports = new ENSService();
