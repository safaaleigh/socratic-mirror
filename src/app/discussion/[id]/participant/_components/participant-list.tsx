"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	AlertCircle,
	Circle,
	Crown,
	User,
	UserMinus,
	UserPlus,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Participant {
	id: string;
	displayName: string;
	type: "user" | "participant";
	role?: "CREATOR" | "MODERATOR" | "PARTICIPANT";
	isOnline: boolean;
	joinedAt: string;
}

interface ParticipantListProps {
	discussionId: string;
	participantId: string;
	token: string;
}

export function ParticipantList({
	discussionId,
	participantId,
	token,
}: ParticipantListProps) {
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recentJoins, setRecentJoins] = useState<Set<string>>(new Set());
	const [recentLeaves, setRecentLeaves] = useState<Set<string>>(new Set());

	useEffect(() => {
		// Set up Server-Sent Events connection for real-time participant updates
		const eventSource = new EventSource(
			`/api/discussion/${discussionId}/stream?participantToken=${encodeURIComponent(token)}&participantId=${encodeURIComponent(participantId)}`,
		);

		eventSource.onopen = () => {
			setIsConnected(true);
			setError(null);
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				switch (data.type) {
					case "connection_established":
						// Initial participant list
						if (data.participants) {
							setParticipants(
								data.participants.map((p: any) => ({
									id: p.id,
									displayName: p.displayName,
									type: p.type,
									role: p.role,
									isOnline: true,
									joinedAt: new Date().toISOString(), // Approximate
								})),
							);
						}
						break;

					case "participant_joined":
						setParticipants((prev) => {
							// Avoid duplicates
							if (prev.some((p) => p.id === data.participantId)) {
								return prev.map((p) =>
									p.id === data.participantId ? { ...p, isOnline: true } : p,
								);
							}

							const newParticipant: Participant = {
								id: data.participantId,
								displayName: data.displayName,
								type: data.participantType || "participant",
								isOnline: true,
								joinedAt: new Date(data.timestamp).toISOString(),
							};

							// Show join animation
							setRecentJoins((prev) => new Set(prev.add(data.participantId)));
							setTimeout(() => {
								setRecentJoins((prev) => {
									const next = new Set(prev);
									next.delete(data.participantId);
									return next;
								});
							}, 2000);

							return [...prev, newParticipant];
						});
						break;

					case "participant_left":
						setParticipants((prev) => {
							// Show leave animation first
							setRecentLeaves((prev) => new Set(prev.add(data.participantId)));

							setTimeout(() => {
								setRecentLeaves((prev) => {
									const next = new Set(prev);
									next.delete(data.participantId);
									return next;
								});

								// Remove participant after animation
								setParticipants((current) =>
									current.filter((p) => p.id !== data.participantId),
								);
							}, 1000);

							// Mark as offline immediately
							return prev.map((p) =>
								p.id === data.participantId ? { ...p, isOnline: false } : p,
							);
						});
						break;

					case "participant_updated":
						setParticipants((prev) =>
							prev.map((p) =>
								p.id === data.participantId
									? { ...p, displayName: data.displayName }
									: p,
							),
						);
						break;
				}
			} catch (error) {
				console.error("Error parsing SSE participant event:", error);
			}
		};

		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
			setIsConnected(false);
			setError("Connection lost. Trying to reconnect...");

			// Don't close immediately, let it try to reconnect
			setTimeout(() => {
				if (eventSource.readyState === EventSource.CLOSED) {
					setError("Failed to connect to real-time updates");
				}
			}, 5000);
		};

		return () => {
			eventSource.close();
		};
	}, [discussionId, participantId, token]);

	// Sort participants: current user first, then by join time
	const sortedParticipants = [...participants].sort((a, b) => {
		if (a.id === participantId) return -1;
		if (b.id === participantId) return 1;
		if (a.role === "CREATOR" && b.role !== "CREATOR") return -1;
		if (b.role === "CREATOR" && a.role !== "CREATOR") return 1;
		if (a.role === "MODERATOR" && b.role === "PARTICIPANT") return -1;
		if (b.role === "MODERATOR" && a.role === "PARTICIPANT") return 1;
		return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
	});

	const onlineCount = participants.filter((p) => p.isOnline).length;

	return (
		<Card className="h-full">
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center justify-between font-medium text-sm">
					<div className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Participants
					</div>
					<Badge variant="secondary" className="text-xs">
						{onlineCount}
					</Badge>
				</CardTitle>
			</CardHeader>

			<CardContent className="space-y-2 pt-0">
				{error && (
					<Alert variant="destructive" className="mb-4">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription className="text-xs">{error}</AlertDescription>
					</Alert>
				)}

				{!isConnected && participants.length === 0 ? (
					// Loading skeleton
					<div className="space-y-2">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex items-center gap-2">
								<Skeleton className="h-8 w-8 rounded-full" />
								<div className="flex-1 space-y-1">
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-2 w-12" />
								</div>
							</div>
						))}
					</div>
				) : participants.length === 0 ? (
					<div className="py-4 text-center text-muted-foreground">
						<Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
						<p className="text-xs">No participants yet</p>
					</div>
				) : (
					<div className="space-y-1">
						{sortedParticipants.map((participant) => (
							<ParticipantItem
								key={participant.id}
								participant={participant}
								isCurrentUser={participant.id === participantId}
								isRecentJoin={recentJoins.has(participant.id)}
								isRecentLeave={recentLeaves.has(participant.id)}
							/>
						))}
					</div>
				)}

				{/* Connection status */}
				<div className="border-t pt-2">
					<div className="flex items-center justify-between text-muted-foreground text-xs">
						<div className="flex items-center gap-1">
							<Circle
								className={`h-2 w-2 fill-current ${
									isConnected ? "text-green-500" : "text-red-500"
								}`}
							/>
							<span>{isConnected ? "Connected" : "Disconnected"}</span>
						</div>
						<span>{onlineCount} online</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

interface ParticipantItemProps {
	participant: Participant;
	isCurrentUser: boolean;
	isRecentJoin: boolean;
	isRecentLeave: boolean;
}

function ParticipantItem({
	participant,
	isCurrentUser,
	isRecentJoin,
	isRecentLeave,
}: ParticipantItemProps) {
	const isCreator = participant.role === "CREATOR";
	const isModerator = participant.role === "MODERATOR";
	const isUser = participant.type === "user";

	return (
		<div
			className={`flex items-center gap-2 rounded-md p-2 transition-all duration-300 ${isCurrentUser ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-800" : ""}
        ${isRecentJoin ? "animate-pulse bg-green-50 dark:bg-green-950/30" : ""}
        ${isRecentLeave ? "bg-red-50 opacity-50 dark:bg-red-950/30" : ""}
        ${!participant.isOnline ? "opacity-60" : ""}hover:bg-muted/50`}
		>
			<div className="relative">
				<Avatar className="h-6 w-6">
					<AvatarImage src="" alt={participant.displayName} />
					<AvatarFallback className="text-xs">
						{participant.displayName.charAt(0).toUpperCase()}
					</AvatarFallback>
				</Avatar>

				{/* Online status indicator */}
				<div
					className={`-bottom-0.5 -right-0.5 absolute h-2 w-2 rounded-full border border-background ${participant.isOnline ? "bg-green-500" : "bg-gray-400"}
          `}
				/>
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1">
					<span className="truncate font-medium text-xs">
						{participant.displayName}
						{isCurrentUser && " (You)"}
					</span>

					{isCreator && (
						<Crown className="h-3 w-3 flex-shrink-0 text-yellow-500" />
					)}
					{isModerator && (
						<Badge
							variant="outline"
							className="h-4 px-1 text-[10px] leading-none"
						>
							MOD
						</Badge>
					)}
				</div>

				<div className="mt-0.5 flex items-center gap-1">
					{isUser ? (
						<Badge
							variant="secondary"
							className="h-3 px-1 text-[9px] leading-none"
						>
							User
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="h-3 px-1 text-[9px] leading-none"
						>
							Participant
						</Badge>
					)}
				</div>
			</div>

			{/* Animation icons */}
			{isRecentJoin && (
				<UserPlus className="h-3 w-3 animate-bounce text-green-500" />
			)}
			{isRecentLeave && (
				<UserMinus className="h-3 w-3 animate-pulse text-red-500" />
			)}
		</div>
	);
}
