"use client";

interface RouteStep {
	protocol: string;
	action: string;
	fromChain: string;
	toChain: string;
	tool?: string;
}

interface RouteVisualizerProps {
	route?: {
		bridges: string[];
		steps?: RouteStep[];
		totalSteps: number;
		estimatedTime: number;
		estimatedOutput: string;
		isMock: boolean;
	} | null;
	tokenOut: string;
}

export function RouteVisualizer({ route, tokenOut }: RouteVisualizerProps) {
	if (!route) {
		return (
			<div className="bg-slate-800/30 backdrop-blur rounded-lg p-4 border border-gray-700">
				<p className="text-gray-400 text-sm text-center">
					No route information available
				</p>
			</div>
		);
	}

	return (
		<div className="bg-linear-to-br from-blue-900/20 to-purple-900/20 backdrop-blur rounded-xl p-5 border border-blue-500/30">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-white font-semibold text-lg flex items-center gap-2">
					🛤️ LI.FI Composer Route
					{route.isMock && (
						<span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded border border-yellow-500/50">
							Simulation
						</span>
					)}
				</h3>
				<div className="text-xs bg-blue-600/30 text-blue-300 px-3 py-1 rounded-full border border-blue-500/50">
					{route.totalSteps} {route.totalSteps === 1 ? "Step" : "Steps"}
				</div>
			</div>

			{/* Route Steps */}
			{route.steps && route.steps.length > 0 ? (
				<div className="space-y-3 mb-4">
					{route.steps.map((step, idx) => (
						<div
							key={idx}
							className="relative">
							{/* Step Card */}
							<div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 hover:border-blue-500/50 transition">
								<div className="flex items-center gap-3">
									{/* Step Number */}
									<div className="flex-shrink-0 w-8 h-8 bg-linear-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
										{idx + 1}
									</div>

									{/* Step Details */}
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<span className="text-white font-semibold text-sm">
												{step.protocol || step.tool || "Protocol"}
											</span>
											<span className="text-xs bg-slate-700 text-gray-300 px-2 py-0.5 rounded">
												{step.action === "swap" ? "🔄 Swap" : "🌉 Bridge"}
											</span>
										</div>
										<div className="text-xs text-gray-400">
											{step.fromChain}
											{step.fromChain !== step.toChain && (
												<>
													<span className="mx-2">→</span>
													{step.toChain}
												</>
											)}
										</div>
									</div>
								</div>
							</div>

							{/* Connector Arrow */}
							{idx < route.steps.length - 1 && (
								<div className="flex justify-center my-1">
									<div className="text-blue-400 text-xl">↓</div>
								</div>
							)}
						</div>
					))}
				</div>
			) : (
				// Simplified route display if no steps
				<div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 mb-4">
					<div className="text-gray-300 text-sm text-center">
						{route.bridges.join(" → ")}
					</div>
				</div>
			)}

			{/* Route Metrics */}
			<div className="grid grid-cols-2 gap-3">
				{/* Estimated Output */}
				<div className="bg-green-900/20 rounded-lg p-3 border border-green-500/30">
					<div className="text-green-400 text-xs mb-1">Est. Output</div>
					<div className="text-white font-bold text-lg">
						{route.estimatedOutput} {tokenOut}
					</div>
				</div>

				{/* Estimated Time */}
				<div className="bg-purple-900/20 rounded-lg p-3 border border-purple-500/30">
					<div className="text-purple-400 text-xs mb-1">Est. Time</div>
					<div className="text-white font-bold text-lg">
						{route.estimatedTime}s
					</div>
				</div>
			</div>

			{/* LI.FI Badge */}
			<div className="mt-4 pt-3 border-t border-slate-700">
				<div className="flex items-center justify-center gap-2 text-xs text-gray-400">
					<span>Powered by</span>
					<span className="text-blue-400 font-semibold">LI.FI Protocol</span>
				</div>
			</div>
		</div>
	);
}
