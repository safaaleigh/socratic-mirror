"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Activity,
	AlertTriangle,
	Circle,
	RefreshCw,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionState =
	| "connecting"
	| "connected"
	| "reconnecting"
	| "disconnected"
	| "error";

interface ConnectionStatusProps {
	discussionId: string;
	participantId: string;
	token: string;
}

export function ConnectionStatus({
	discussionId,
	participantId,
	token,
}: ConnectionStatusProps) {
	const [connectionState, setConnectionState] =
		useState<ConnectionState>("connecting");
	const [lastConnected, setLastConnected] = useState<Date | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [reconnectAttempts, setReconnectAttempts] = useState(0);
	const [isOnline, setIsOnline] = useState(navigator.onLine);
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const maxReconnectAttempts = 5;
	const reconnectDelay = 2000; // Base delay in milliseconds

	// Monitor browser online/offline status
	useEffect(() => {
		const handleOnline = () => {
			setIsOnline(true);
			if (connectionState === "disconnected") {
				// Trigger reconnection
				setConnectionState("connecting");
			}
		};

		const handleOffline = () => {
			setIsOnline(false);
			setConnectionState("disconnected");
			setErrorMessage("No internet connection");
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [connectionState]);

	const handleConnectionError = useCallback(
		(error: any) => {
			console.error("SSE connection error:", error);

			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}

			if (!isOnline) {
				setConnectionState("disconnected");
				setErrorMessage("No internet connection");
				return;
			}

			if (reconnectAttempts < maxReconnectAttempts) {
				setConnectionState("reconnecting");
				setErrorMessage(
					`Reconnecting... (${reconnectAttempts + 1}/${maxReconnectAttempts})`,
				);
				setReconnectAttempts((prev) => prev + 1);

				const delay = Math.min(reconnectDelay * 2 ** reconnectAttempts, 30000); // Exponential backoff, max 30s

				reconnectTimeoutRef.current = setTimeout(() => {
					setConnectionState("connecting");
				}, delay);
			} else {
				setConnectionState("error");
				setErrorMessage("Failed to connect after multiple attempts");
			}
		},
		[isOnline, reconnectAttempts],
	);

	// Trigger connection attempt when state changes to connecting
	useEffect(() => {
		if (connectionState === "connecting" && isOnline) {
			// Inline the connection logic to avoid dependency issues
			// Close existing connection
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}

			setErrorMessage(null);

			const eventSource = new EventSource(
				`/api/discussion/${discussionId}/stream?participantToken=${encodeURIComponent(token)}&participantId=${encodeURIComponent(participantId)}`,
			);

			eventSourceRef.current = eventSource;

			const connectionTimeout = setTimeout(() => {
				if (eventSource.readyState === EventSource.CONNECTING) {
					eventSource.close();
					handleConnectionError(new Error("Connection timeout"));
				}
			}, 10000); // 10 second timeout

			eventSource.onopen = () => {
				clearTimeout(connectionTimeout);
				setConnectionState("connected");
				setLastConnected(new Date());
				setErrorMessage(null);
				setReconnectAttempts(0);
			};

			eventSource.onmessage = (event) => {
				// Connection is working if we receive messages
				if (connectionState !== "connected") {
					setConnectionState("connected");
					setLastConnected(new Date());
				}
			};

			eventSource.onerror = (error) => {
				clearTimeout(connectionTimeout);
				handleConnectionError(error);
			};
		}
	}, [
		connectionState,
		isOnline,
		discussionId,
		token,
		participantId,
		handleConnectionError,
	]);

	const attemptConnection = useCallback(() => {
		if (!isOnline) {
			setConnectionState("disconnected");
			setErrorMessage("No internet connection");
			return;
		}

		setConnectionState("connecting");
	}, [isOnline]);

	const handleManualReconnect = () => {
		setReconnectAttempts(0);
		attemptConnection();
	};

	// Initial connection
	useEffect(() => {
		attemptConnection();

		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [attemptConnection]);

	// Periodic connection health check
	useEffect(() => {
		if (connectionState === "connected") {
			const healthCheck = setInterval(() => {
				// Check if connection is still alive by examining readyState
				if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
					handleConnectionError(new Error("Connection closed unexpectedly"));
				}
			}, 30000); // Check every 30 seconds

			return () => clearInterval(healthCheck);
		}
	}, [connectionState, handleConnectionError]);

	const getStatusConfig = () => {
		switch (connectionState) {
			case "connecting":
				return {
					icon: <Activity className="h-3 w-3 animate-pulse" />,
					text: "Connecting",
					variant: "outline" as const,
					color: "text-yellow-600",
					bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
				};
			case "connected":
				return {
					icon: <Wifi className="h-3 w-3" />,
					text: "Connected",
					variant: "secondary" as const,
					color: "text-green-600",
					bgColor: "bg-green-50 dark:bg-green-950/30",
				};
			case "reconnecting":
				return {
					icon: <RefreshCw className="h-3 w-3 animate-spin" />,
					text: "Reconnecting",
					variant: "outline" as const,
					color: "text-orange-600",
					bgColor: "bg-orange-50 dark:bg-orange-950/30",
				};
			case "disconnected":
				return {
					icon: <WifiOff className="h-3 w-3" />,
					text: "Offline",
					variant: "destructive" as const,
					color: "text-red-600",
					bgColor: "bg-red-50 dark:bg-red-950/30",
				};
			case "error":
				return {
					icon: <AlertTriangle className="h-3 w-3" />,
					text: "Error",
					variant: "destructive" as const,
					color: "text-red-600",
					bgColor: "bg-red-50 dark:bg-red-950/30",
				};
		}
	};

	const config = getStatusConfig();

	const tooltipContent = (
		<div className="space-y-1 text-xs">
			<div className="font-medium">Connection Status</div>
			<div>State: {connectionState}</div>
			{lastConnected && (
				<div>Last connected: {lastConnected.toLocaleTimeString()}</div>
			)}
			{errorMessage && (
				<div className="text-red-400">Error: {errorMessage}</div>
			)}
			{!isOnline && <div className="text-orange-400">Browser is offline</div>}
		</div>
	);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div className="flex items-center gap-2">
					<div
						className={`flex items-center gap-1 rounded-md px-2 py-1 ${config.bgColor}`}
					>
						<div className={config.color}>{config.icon}</div>
						<span className={`font-medium text-xs ${config.color}`}>
							{config.text}
						</span>
					</div>

					{/* Connection quality indicator */}
					<div className="flex items-center gap-0.5">
						<Circle
							className={`h-1.5 w-1.5 fill-current ${
								connectionState === "connected"
									? "text-green-500"
									: "text-gray-300"
							}`}
						/>
						<Circle
							className={`h-1.5 w-1.5 fill-current ${
								connectionState === "connected" && lastConnected
									? "text-green-500"
									: "text-gray-300"
							}`}
						/>
						<Circle
							className={`h-1.5 w-1.5 fill-current ${
								connectionState === "connected" && reconnectAttempts === 0
									? "text-green-500"
									: "text-gray-300"
							}`}
						/>
					</div>

					{/* Manual reconnect button for error state */}
					{(connectionState === "error" ||
						connectionState === "disconnected") &&
						isOnline && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleManualReconnect}
								className="h-6 w-6 p-0"
							>
								<RefreshCw className="h-3 w-3" />
							</Button>
						)}
				</div>
			</TooltipTrigger>
			<TooltipContent>{tooltipContent}</TooltipContent>
		</Tooltip>
	);
}
