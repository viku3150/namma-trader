"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { IntentForm } from "./components/IntentForm";
import toast, { Toaster } from "react-hot-toast";
import { IntentList } from "./components/IntentList";

export default function Home() {
	const { address, isConnected } = useAccount();
	const { connect, connectors } = useConnect();
	const { disconnect } = useDisconnect();

	const [depositAmount, setDepositAmount] = useState("100");
	const [channelId, setChannelId] = useState("");
	const [balance, setBalance] = useState("");
	const [loading, setLoading] = useState(false);
	const [depositLoading, setDepositLoading] = useState(false);
	const [ensName, setEnsName] = useState<string | null>(null);
	const [ensAvatar, setEnsAvatar] = useState<string | null>(null); // Day 4: Avatar
	const [intents, setIntents] = useState<any[]>([]);
	const [feeInfo, setFeeInfo] = useState<any>(null);
	const [depositToChannelAmount, setDepositToChannelAmount] = useState("50");
	const [channelClosed, setChannelClosed] = useState(false);
	const [settlementInfo, setSettlementInfo] = useState<any>(null);

	// Resolve ENS when address changes
	useEffect(() => {
		if (isConnected && address && !ensName) {
			resolveENS(address);
		}
	}, [isConnected, address]);

	const loadFeeInfo = async () => {
		if (!address) return;
		try {
			const response = await fetch(`${config.backendUrl}/api/fee/${address}`);
			const data = await response.json();
			if (data.success) {
				setFeeInfo(data.feeInfo);
			}
		} catch (error) {
			console.error("Failed to load fee info:", error);
		}
	};

	// Auto-refresh intents
	useEffect(() => {
		if (intents.length > 0) {
			const interval = setInterval(() => {
				loadIntents();
			}, 2000);

			return () => clearInterval(interval);
		}
	}, [intents.length]);

	const resolveENS = async (addr: string) => {
		try {
			const response = await fetch(`${config.backendUrl}/api/ens/${addr}`);
			const data = await response.json();
			if (data.resolved) {
				if (typeof data.resolved === "string" && data.resolved !== addr) {
					setEnsName(data.resolved);
				} else if (data.name) {
					setEnsName(data.name);
					if (data.avatar) {
						setEnsAvatar(data.avatar);
					}
				}
			}
		} catch (error) {
			console.error("ENS resolution failed:", error);
		}
	};

	// Load fee info when address changes or intents update
	useEffect(() => {
		if (address) {
			loadFeeInfo();
		}
	}, [address, intents]);

	const createChannel = async () => {
		setLoading(true);
		const toastId = toast.loading("Creating channel...");

		try {
			const response = await fetch("${config.backendUrl}/api/channel/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ depositAmount: parseFloat(depositAmount) }),
			});
			const data = await response.json();

			setChannelId(data.channel.channelId);
			if (data.channel.ensName) {
				setEnsName(data.channel.ensName);
			}

			toast.success("Channel created successfully!", { id: toastId });
		} catch (error: any) {
			toast.error(`Error: ${error.message}`, { id: toastId });
		} finally {
			setLoading(false);
		}
	};

	const closeChannel = async () => {
		if (!channelId) return;

		const toastId = toast.loading("Settling channel on-chain...");

		try {
			const response = await fetch(
				`${config.backendUrl}/api/channel/${channelId}/close`,
				{
					method: "POST",
				},
			);

			const data = await response.json();

			if (data.success) {
				toast.success(
					`Channel settled! ${data.withdrawnAmount} USDC withdrawn`,
					{
						id: toastId,
						duration: 5000,
					},
				);
				setChannelClosed(true);
				setSettlementInfo(data);
			} else {
				throw new Error(data.error);
			}
		} catch (error: any) {
			toast.error(`Error: ${error.message}`, { id: toastId });
		}
	};

	const depositToChannel = async () => {
		if (!channelId) return;

		setDepositLoading(true);
		const toastId = toast.loading("Depositing to channel...");

		try {
			const response = await fetch("${config.backendUrl}/api/channel/deposit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					channelId,
					amount: parseFloat(depositToChannelAmount),
				}),
			});

			const data = await response.json();

			if (data.success) {
				toast.success(`Deposited ${depositToChannelAmount} USDC!`, {
					id: toastId,
				});
				setTimeout(async () => {
					await checkBalance();
				}, 1000);
			} else {
				throw new Error(data.error);
			}
		} catch (error: any) {
			toast.error(`Error: ${error.message}`, { id: toastId });
		} finally {
			setDepositLoading(false);
		}
	};

	const checkBalance = async () => {
		if (!channelId) return;
		try {
			const response = await fetch(
				`${config.backendUrl}/api/channel/${channelId}/balance`,
			);
			const data = await response.json();
			setBalance(data.balance.total || data.balance);
		} catch (error: any) {
			toast.error(`Error: ${error.message}`);
		}
	};

	const handleIntentSubmitted = (intent: any) => {
		// ✅ Check if intent already exists (prevent duplicates)
		const existingIntent = intents.find((i) => i.intentId === intent.intentId);
		if (existingIntent) {
			console.log("Intent already exists, skipping duplicate");
			return;
		}

		setIntents([intent, ...intents]);
		toast.success("Intent submitted to solvers!");

		// Refresh balance after execution
		setTimeout(async () => {
			await checkBalance();
		}, 4000);
	};

	const loadIntents = async () => {
		try {
			const response = await fetch("${config.backendUrl}/api/intents");
			const data = await response.json();
			setIntents(data.intents || []);
		} catch (error) {
			console.error("Failed to load intents:", error);
		}
	};

	useEffect(() => {
		if (channelId && !channelClosed) {
			const interval = setInterval(() => {
				checkBalance();
			}, 3000); // Refresh every 3 seconds

			return () => clearInterval(interval);
		}
	}, [channelId, channelClosed]);

	return (
		<main
			className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-purple-900 p-8"
			suppressHydrationWarning>
			<Toaster position="top-right" />

			<div className="max-w-6xl mx-auto">
				<div className="flex items-center justify-between mb-8">
					<div>
						<h1 className="text-4xl font-bold text-white mb-2">
							⚡ Namma Global Trader
						</h1>
						<p className="text-gray-400 text-sm">
							Gasless cross-chain trading via ERC-7824 state channels + LI.FI
						</p>
					</div>
				</div>

				{/* Wallet Connection */}
				<div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-purple-500/30">
					<h2 className="text-xl font-semibold text-white mb-4">
						🔐 Wallet Connection
					</h2>
					{isConnected ? (
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{/* Day 4: ENS Avatar */}
								{ensAvatar && (
									<img
										src={ensAvatar}
										alt="ENS Avatar"
										className="w-12 h-12 rounded-full border-2 border-purple-500"
									/>
								)}
								{!ensAvatar && ensName && (
									<div className="w-12 h-12 rounded-full bg-linear-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-lg border-2 border-purple-500">
										{ensName.charAt(0).toUpperCase()}
									</div>
								)}
								{!ensAvatar && !ensName && (
									<div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-bold text-lg border-2 border-blue-500">
										{address?.charAt(2).toUpperCase()}
									</div>
								)}
								<div>
									<div className="flex items-center gap-2">
										{ensName && (
											<span className="text-green-400 font-semibold text-lg">
												{ensName}
											</span>
										)}
										<span className="text-gray-400 font-mono text-sm">
											{address?.slice(0, 6)}...{address?.slice(-4)}
										</span>
									</div>
									<div className="text-xs text-gray-400 mt-1">
										Sepolia Testnet
									</div>
								</div>
							</div>
							<button
								onClick={() => disconnect()}
								className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
								Disconnect
							</button>
						</div>
					) : (
						<div className="space-y-2">
							{connectors.map((connector) => (
								<button
									key={connector.id}
									onClick={() => connect({ connector })}
									className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 w-full font-semibold transition">
									Connect {connector.name}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Dynamic Fee Info Card */}
				{isConnected && feeInfo && (
					<div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 mb-6 border border-blue-500/30">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-semibold text-white">
								💎 Your Dynamic Fee Rate (Uniswap v4 Style)
							</h2>
							<button
								onClick={loadFeeInfo}
								className="text-sm text-blue-400 hover:text-blue-300 transition">
								🔄 Refresh
							</button>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							{/* Current Fee */}
							<div className="bg-linear-to-br from-blue-900/50 to-blue-800/30 p-4 rounded-lg border border-blue-500/30">
								<div className="text-blue-300 text-xs mb-1 font-semibold">
									Current Fee
								</div>
								<div className="text-white text-3xl font-bold">
									{feeInfo.fee}%
								</div>
								{feeInfo.savings > 0 && (
									<div className="text-green-400 text-xs mt-2 flex items-center gap-1">
										<span>↓</span>
										<span>{(feeInfo.savings / 100).toFixed(2)}% saved</span>
									</div>
								)}
								{feeInfo.savings === 0 && (
									<div className="text-gray-400 text-xs mt-2">Base rate</div>
								)}
							</div>

							{/* Trading Volume */}
							<div className="bg-linear-to-br from-purple-900/50 to-purple-800/30 p-4 rounded-lg border border-purple-500/30">
								<div className="text-purple-300 text-xs mb-1 font-semibold">
									Trading Volume
								</div>
								<div className="text-white text-3xl font-bold">
									{feeInfo.volume}
								</div>
								<div className="text-gray-300 text-xs mt-2">USDC traded</div>
							</div>

							{/* Swaps Completed */}
							<div className="bg-linear-to-br from-green-900/50 to-green-800/30 p-4 rounded-lg border border-green-500/30">
								<div className="text-green-300 text-xs mb-1 font-semibold">
									Completed Swaps
								</div>
								<div className="text-white text-3xl font-bold">
									{feeInfo.swapCount}
								</div>
								<div className="text-gray-300 text-xs mt-2">
									intents fulfilled
								</div>
							</div>

							{/* Next Tier */}
							<div className="bg-linear-to-br from-yellow-900/50 to-yellow-800/30 p-4 rounded-lg border border-yellow-500/30">
								<div className="text-yellow-300 text-xs mb-1 font-semibold">
									Next Tier At
								</div>
								<div className="text-white text-3xl font-bold">
									{(() => {
										const currentVolume = parseFloat(feeInfo.volume) || 0;
										const nextTier = Math.ceil(currentVolume / 100) * 100;
										const displayTier =
											currentVolume % 100 === 0 && currentVolume > 0
												? currentVolume + 100
												: nextTier;
										return displayTier;
									})()}
								</div>
								<div className="text-gray-300 text-xs mt-2">
									{(() => {
										const currentVolume = parseFloat(feeInfo.volume) || 0;
										const nextTier = Math.ceil(currentVolume / 100) * 100;
										const displayTier =
											currentVolume % 100 === 0 && currentVolume > 0
												? currentVolume + 100
												: nextTier;
										const remaining = Math.max(0, displayTier - currentVolume);
										return `${remaining.toFixed(0)} USDC to go`;
									})()}
								</div>
							</div>
						</div>

						{/* Info Banner */}
						<div className="mt-4 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-500/20">
							<div className="flex items-start gap-3">
								<div className="text-2xl">💡</div>
								<div>
									<p className="text-blue-200 text-sm font-semibold mb-1">
										Dynamic Fee Optimization
									</p>
									<p className="text-blue-300/80 text-xs">
										Trade more to unlock lower fees! Every 100 USDC in volume
										reduces your fee by 0.05%. Minimum fee: {feeInfo.minFee}% •
										Base fee: {feeInfo.baseFee}%
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left Column */}
					<div className="space-y-6">
						{/* Channel Creation */}
						<div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-500/30">
							<h2 className="text-xl font-semibold text-white mb-4">
								⚡ Create State Channel
							</h2>
							<div className="space-y-4">
								<div>
									<label className="block text-gray-300 mb-2 text-sm">
										Initial Deposit Amount
									</label>
									<div className="relative">
										<input
											type="number"
											value={depositAmount}
											onChange={(e) => setDepositAmount(e.target.value)}
											className="w-full px-4 py-3 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-purple-500 transition"
											placeholder="100"
										/>
										<span className="absolute right-4 top-3 text-gray-400 text-sm">
											USDC
										</span>
									</div>
								</div>
								<button
									onClick={createChannel}
									disabled={!isConnected || loading}
									className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed font-semibold transition">
									{loading ? "⏳ Creating Channel..." : "🚀 Create Channel"}
								</button>
							</div>
						</div>

						{/* Channel Info + Deposit */}
						{channelId && (
							<div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-green-500/30">
								<h2 className="text-xl font-semibold text-white mb-4">
									✅ Channel Active
								</h2>
								<div className="space-y-4">
									<div className="bg-slate-700/50 p-4 rounded-lg">
										<span className="text-gray-400 text-sm">Channel ID</span>
										<p className="text-white font-mono text-xs mt-1 break-all">
											{channelId}
										</p>
									</div>
									<div className="bg-slate-700/50 p-4 rounded-lg">
										<span className="text-gray-400 text-sm">
											On-Chain Balance
										</span>
										<p className="text-white text-3xl font-bold mt-2">
											{balance || "0.0"}{" "}
											<span className="text-xl text-gray-400">USDC</span>
										</p>
									</div>
									<button
										onClick={checkBalance}
										className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
										🔄 Refresh Balance
									</button>

									{/* Deposit Section */}
									<div className="border-t border-gray-700 pt-4 mt-4">
										<label className="block text-gray-300 mb-2 text-sm">
											💰 Add More Funds
										</label>
										<div className="flex gap-2">
											<div className="relative flex-1">
												<input
													type="number"
													value={depositToChannelAmount}
													onChange={(e) =>
														setDepositToChannelAmount(e.target.value)
													}
													className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-green-500 transition"
													placeholder="50"
												/>
												<span className="absolute right-3 top-2 text-gray-400 text-sm">
													USDC
												</span>
											</div>
											<button
												onClick={depositToChannel}
												disabled={depositLoading}
												className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-semibold transition whitespace-nowrap">
												{depositLoading ? "⏳" : "💵 Deposit"}
											</button>
										</div>
									</div>
								</div>
							</div>
						)}

						{!channelClosed && (
							<div className="border-t border-gray-700 pt-4 mt-4">
								<button
									onClick={closeChannel}
									className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 font-semibold transition flex items-center justify-center gap-2">
									🔒 Close Channel & Settle On-Chain
								</button>
								<p className="text-xs text-gray-400 mt-2 text-center">
									Finalizes all trades and withdraws {balance || "0"} USDC to
									your wallet
								</p>
							</div>
						)}

						{channelClosed && settlementInfo && (
							<div className="bg-linear-to-br from-green-900/40 to-emerald-900/40 p-6 rounded-lg border border-green-500 mt-4">
								<div className="flex items-center gap-3 text-green-400 font-semibold text-lg mb-4">
									✅ Channel Settled Successfully
								</div>

								{/* Settlement Details */}
								<div className="space-y-3">
									<div className="bg-green-950/50 p-3 rounded">
										<div className="text-green-300 text-xs mb-1">
											Withdrawn Amount
										</div>
										<div className="text-white text-2xl font-bold">
											{settlementInfo.withdrawnAmount} USDC
										</div>
									</div>

									<div className="grid grid-cols-2 gap-2 text-xs">
										<div className="bg-green-950/50 p-2 rounded">
											<div className="text-green-300 mb-1">Settlement Tx</div>
											<div className="text-white font-mono break-all">
												{settlementInfo.settlementTx.slice(0, 10)}...
												{settlementInfo.settlementTx.slice(-8)}
											</div>
										</div>

										<div className="bg-green-950/50 p-2 rounded">
											<div className="text-green-300 mb-1">Block Number</div>
											<div className="text-white font-bold">
												#{settlementInfo.blockNumber}
											</div>
										</div>

										<div className="bg-green-950/50 p-2 rounded">
											<div className="text-green-300 mb-1">
												Session Duration
											</div>
											<div className="text-white font-bold">
												{settlementInfo.sessionDuration}s
											</div>
										</div>

										<div className="bg-green-950/50 p-2 rounded">
											<div className="text-green-300 mb-1">
												Intents Executed
											</div>
											<div className="text-white font-bold">
												{settlementInfo.intentsExecuted}
											</div>
										</div>
									</div>
								</div>

								{/* Success Message */}
								<div className="mt-4 p-3 bg-green-900/30 rounded border border-green-700">
									<p className="text-green-200 text-sm">
										💰 <strong>{settlementInfo.withdrawnAmount} USDC</strong>{" "}
										has been withdrawn to your wallet address ending in{" "}
										<strong>...{address?.slice(-4)}</strong>
									</p>
									<p className="text-green-300 text-xs mt-2">
										Gas cost: <strong>$0.00</strong> (sponsored by state
										channel)
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Right Column - Intent Form & List */}
					<div className="space-y-6">
						{channelId ? (
							<IntentForm
								channelId={channelId}
								balance={balance}
								onIntentSubmitted={handleIntentSubmitted}
							/>
						) : (
							<div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-gray-500/30">
								<h2 className="text-xl font-semibold text-white mb-4">
									📊 Submit Trading Intent
								</h2>
								<div className="text-center py-12">
									<div className="text-6xl mb-4">📋</div>
									<p className="text-gray-400 mb-2">No active channel</p>
									<p className="text-gray-500 text-sm">
										Create a state channel to start trading
									</p>
								</div>
							</div>
						)}

						{/* Intent List with Solver Auction Display */}
						<IntentList intents={intents} />
					</div>
				</div>
			</div>
		</main>
	);
}
