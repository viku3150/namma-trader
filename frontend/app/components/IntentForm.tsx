"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface IntentFormProps {
	channelId: string;
	balance?: string; // ✅ NEW: Pass current balance
	onIntentSubmitted: (intent: any) => void;
}

export function IntentForm({
	channelId,
	balance,
	onIntentSubmitted,
}: IntentFormProps) {
	const [sellAmount, setSellAmount] = useState("10");
	const [buyToken, setBuyToken] = useState("SUI");
	const [minAmount, setMinAmount] = useState("9.5");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// ✅ NEW: Check if sufficient balance
		const currentBalance = parseFloat(balance || "0");
		const requestedAmount = parseFloat(sellAmount);

		if (requestedAmount > currentBalance) {
			toast.error(
				`Insufficient balance! You have ${currentBalance} USDC but trying to swap ${requestedAmount} USDC`,
				{ duration: 5000 },
			);
			return;
		}

		if (requestedAmount <= 0) {
			toast.error("Amount must be greater than 0");
			return;
		}

		setSubmitting(true);

		try {
			const response = await fetch("${config.backendUrl}/api/intent/submit", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					channelId,
					intent: {
						amountIn: parseFloat(sellAmount),
						tokenOut: buyToken,
						minAmountOut: parseFloat(minAmount),
					},
				}),
			});

			const data = await response.json();

			if (data.success) {
				onIntentSubmitted(data.intent);
				// Reset form
				setSellAmount("10");
				setMinAmount("9.5");
			} else {
				toast.error(`Error: ${data.error}`);
			}
		} catch (error: any) {
			toast.error(`Error: ${error.message}`);
		} finally {
			setSubmitting(false);
		}
	};

	const currentBalance = parseFloat(balance || "0");
	const requestedAmount = parseFloat(sellAmount || "0");
	const insufficientBalance = requestedAmount > currentBalance;

	return (
		<div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-yellow-500/30">
			<h2 className="text-xl font-semibold text-white mb-4">
				📊 Submit Trading Intent
			</h2>

			{/* ✅ NEW: Balance warning banner */}
			{currentBalance === 0 && (
				<div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg">
					<p className="text-red-300 text-sm">
						⚠️ No balance in channel. Please deposit USDC first.
					</p>
				</div>
			)}

			<form
				onSubmit={handleSubmit}
				className="space-y-4">
				{/* Sell Amount */}
				<div>
					<label className="block text-gray-300 mb-2 text-sm">
						Sell Amount
					</label>
					<div className="relative">
						<input
							type="number"
							value={sellAmount}
							onChange={(e) => setSellAmount(e.target.value)}
							className={`w-full px-4 py-3 bg-slate-700/50 text-white rounded-lg border ${
								insufficientBalance ? "border-red-500" : "border-slate-600"
							} focus:outline-none focus:border-yellow-500 transition`}
							placeholder="10"
							step="0.01"
							min="0"
						/>
						<span className="absolute right-4 top-3 text-gray-400 text-sm">
							USDC
						</span>
					</div>
					{/* ✅ NEW: Balance display + warning */}
					<div className="mt-2 flex items-center justify-between text-xs">
						<span className="text-gray-400">
							Available:{" "}
							<span className="text-white font-semibold">{currentBalance}</span>{" "}
							USDC
						</span>
						{insufficientBalance && requestedAmount > 0 && (
							<span className="text-red-400 font-semibold">
								⚠️ Insufficient balance!
							</span>
						)}
					</div>
				</div>

				{/* Buy Token */}
				<div>
					<label className="block text-gray-300 mb-2 text-sm">Buy Token</label>
					<select
						value={buyToken}
						onChange={(e) => setBuyToken(e.target.value)}
						className="w-full px-4 py-3 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-yellow-500 transition">
						<option value="SUI">SUI</option>
						<option value="ETH">ETH</option>
						<option value="USDT">USDT</option>
					</select>
				</div>

				{/* Min Amount Out */}
				<div>
					<label className="block text-gray-300 mb-2 text-sm">
						Minimum Amount Out
					</label>
					<div className="relative">
						<input
							type="number"
							value={minAmount}
							onChange={(e) => setMinAmount(e.target.value)}
							className="w-full px-4 py-3 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-yellow-500 transition"
							placeholder="9.5"
							step="0.01"
						/>
						<span className="absolute right-4 top-3 text-gray-400 text-sm">
							{buyToken}
						</span>
					</div>
					<p className="text-xs text-gray-400 mt-1">
						Intent will fail if output is below this amount
					</p>
				</div>

				{/* Submit Button */}
				<button
					type="submit"
					disabled={submitting || currentBalance === 0 || insufficientBalance}
					className="w-full px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:from-yellow-700 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed font-semibold transition">
					{submitting
						? "⏳ Submitting..."
						: insufficientBalance
							? "❌ Insufficient Balance"
							: currentBalance === 0
								? "❌ No Balance"
								: "🚀 Submit Intent"}
				</button>

				{/* ✅ NEW: Helper text */}
				{!insufficientBalance && currentBalance > 0 && (
					<p className="text-xs text-gray-400 text-center">
						Gasless execution via state channel • Settled off-chain
					</p>
				)}
			</form>
		</div>
	);
}
