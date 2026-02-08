"use client";

import { useState } from "react";
import { RouteVisualizer } from "./RouteVisualizer";

interface Intent {
	intentId: string;
	trader: string;
	traderENS?: string;
	tokenIn: string;
	tokenOut: string;
	amountIn: number;
	minAmountOut: number;
	amountOut?: string;
	status: string;
	createdAt: number;
	fulfilledAt?: number;
	executionRoute?: string;
	routeDetails?: any[];
	routeSteps?: number;
	route?: {
		bridges: string[];
		steps?: any[];
		totalSteps: number;
		estimatedTime: number;
		estimatedOutput: string;
		isMock: boolean;
	};
}

interface IntentListProps {
	intents: Intent[];
}

export function IntentList({ intents }: IntentListProps) {
	const [expandedIntent, setExpandedIntent] = useState<string | null>(null);

	const getStatusColor = (status: string) => {
		switch (status) {
			case "fulfilled":
				return "bg-green-900/30 border-green-500 text-green-400";
			case "pending":
				return "bg-yellow-900/30 border-yellow-500 text-yellow-400";
			case "failed":
				return "bg-red-900/30 border-red-500 text-red-400";
			default:
				return "bg-gray-900/30 border-gray-500 text-gray-400";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "fulfilled":
				return "✅";
			case "pending":
				return "⏳";
			case "failed":
				return "❌";
			default:
				return "🔄";
		}
	};

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString();
	};

	return (
		<div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-purple-500/30">
			<h2 className="text-xl font-semibold text-white mb-4">
				📜 Intent History
			</h2>

			{intents.length === 0 ? (
				<div className="text-center py-8 text-gray-400">
					No intents submitted yet
				</div>
			) : (
				// ✅ ADD: max-height and overflow for scrolling
				<div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800">
					{intents.map((intent) => (
						<div key={intent.intentId}>
							{/* Intent Card */}
							<div
								className={`rounded-lg p-4 border ${getStatusColor(intent.status)} cursor-pointer hover:scale-[1.01] transition`}
								onClick={() =>
									setExpandedIntent(
										expandedIntent === intent.intentId ? null : intent.intentId,
									)
								}>
								{/* Header Row */}
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<span className="text-2xl">
											{getStatusIcon(intent.status)}
										</span>
										<span className="text-white font-semibold capitalize">
											{intent.status}
										</span>
									</div>
									<div className="text-xs text-gray-400">
										{formatTime(intent.createdAt)}
									</div>
								</div>

								{/* Trade Details */}
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<div className="text-gray-400 text-xs mb-1">Sell</div>
										<div className="text-white font-semibold">
											{intent.amountIn} USDC
										</div>
									</div>
									<div>
										<div className="text-gray-400 text-xs mb-1">Buy</div>
										<div className="text-white font-semibold">
											{intent.amountOut || intent.minAmountOut}{" "}
											{intent.tokenOut}
										</div>
									</div>
								</div>

								{/* Execution Route (if available) */}
								{intent.executionRoute && (
									<div className="mt-3 pt-3 border-t border-slate-700">
										<div className="text-xs text-gray-400 mb-1">Route</div>
										<div className="text-white text-xs font-mono">
											{intent.executionRoute}
										</div>
									</div>
								)}

								{/* Expand Indicator */}
								{intent.route && (
									<div className="mt-2 text-center text-xs text-blue-400">
										{expandedIntent === intent.intentId
											? "▼ Hide Route Details"
											: "▶ Show Route Details"}
									</div>
								)}
							</div>

							{/* Expanded Route Details */}
							{expandedIntent === intent.intentId && intent.route && (
								<div className="mt-3">
									<RouteVisualizer
										route={intent.route}
										tokenOut={intent.tokenOut}
									/>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
