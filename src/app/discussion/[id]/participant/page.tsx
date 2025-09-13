"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import {
	AlertCircle,
	CheckCircle,
	Clock,
	MessageCircle,
	Users,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ConnectionStatus } from "./_components/connection-status";
import { MessageHistory } from "./_components/message-history";
import { ParticipantChat } from "./_components/participant-chat";
import { ParticipantList } from "./_components/participant-list";

type ParticipantData = {
	id: string;
	discussionId: string;
	displayName: string;
	joinedAt: string;
	leftAt: string | null;
};

type MessageHistoryData = {
	id: string;
	content: string;
	senderName: string;
	senderType: "user" | "participant" | "system";
	createdAt: string;
};

export default function ParticipantDiscussionPage() {
	const params = useParams();
	const searchParams = useSearchParams();
	const discussionId = params.id as string;

	// URL parameters for invitation validation
	const token = searchParams.get("token");

	// Local state management
	const [participantId, setParticipantId] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [sessionId, setSessionId] = useState("");
	const [isJoining, setIsJoining] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	const [messageHistory, setMessageHistory] = useState<MessageHistoryData[]>(
		[],
	);

	// Generate session ID on mount
	useEffect(() => {
		if (!sessionId) {
			setSessionId(
				`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			);
		}
	}, [sessionId]);

	// Load participant data from localStorage if available
	useEffect(() => {
		const savedParticipantId = localStorage.getItem(
			`participant_${discussionId}`,
		);
		const savedDisplayName = localStorage.getItem(
			`displayName_${discussionId}`,
		);

		if (savedParticipantId && savedDisplayName) {
			setParticipantId(savedParticipantId);
			setDisplayName(savedDisplayName);
		}
	}, [discussionId]);

	// Validate invitation token using the unified system
	const {
		data: validation,
		isLoading: isValidating,
		error: validationError,
	} = api.unifiedInvitation.validate.useQuery(
		{
			token: token || "",
		},
		{
			enabled: !!token,
			retry: false,
		},
	);

	// Join discussion mutation
	const joinDiscussionMutation = api.participant.join.useMutation({
		onSuccess: (data) => {
			setParticipantId(data.participant.id);
			setMessageHistory(data.messageHistory);
			setJoinError(null);

			// Store participant info in localStorage
			localStorage.setItem(`participant_${discussionId}`, data.participant.id);
			localStorage.setItem(
				`displayName_${discussionId}`,
				data.participant.displayName,
			);
		},
		onError: (error) => {
			setJoinError(error.message);
		},
		onSettled: () => {
			setIsJoining(false);
		},
	});

	const handleJoinDiscussion = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!displayName.trim()) {
			setJoinError("Please enter a display name");
			return;
		}

		setIsJoining(true);
		setJoinError(null);

		joinDiscussionMutation.mutate({
			discussionId,
			displayName: displayName.trim(),
			sessionId,
			ipAddress: undefined, // Will be extracted server-side if needed
		});
	};

	const handleLeaveDiscussion = () => {
		if (
			participantId &&
			confirm("Are you sure you want to leave this discussion?")
		) {
			// Clear local storage
			localStorage.removeItem(`participant_${discussionId}`);
			localStorage.removeItem(`displayName_${discussionId}`);
			setParticipantId(null);
			setMessageHistory([]);
		}
	};

	// Loading states
	if (!token) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Invalid invitation link. Please check the URL and try again.
						</AlertDescription>
					</Alert>
				</div>
			</div>
		);
	}

	if (isValidating) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<Card>
						<CardContent className="p-8">
							<div className="flex items-center justify-center space-x-4">
								<Skeleton className="h-8 w-8 rounded-full" />
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-4 w-24" />
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	if (validationError || !validation?.valid) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							{validation?.error ||
								validationError?.message ||
								"Failed to validate invitation"}
						</AlertDescription>
					</Alert>
				</div>
			</div>
		);
	}

	const discussion = validation.discussion;
	
	if (!discussion) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Discussion information unavailable
						</AlertDescription>
					</Alert>
				</div>
			</div>
		);
	}

	// Join form (if not yet joined)
	if (!participantId) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto max-w-md px-4 py-8">
					<Card>
						<CardContent className="p-6">
							<div className="mb-6 text-center">
								<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
									<MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
								</div>
								<h1 className="font-semibold text-xl">{discussion.name}</h1>
								<p className="mt-2 text-muted-foreground text-sm">
									Join the discussion as a participant
								</p>
							</div>

							<div className="mb-6 grid grid-cols-2 gap-4 text-center">
								<div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
									<Users className="mb-1 h-4 w-4 text-muted-foreground" />
									<span className="font-medium text-sm">
										{discussion.participantCount}
									</span>
									<span className="text-muted-foreground text-xs">
										Participants
									</span>
								</div>
								<div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
									<CheckCircle className="mb-1 h-4 w-4 text-green-500" />
									<span className="font-medium text-sm">
										Active
									</span>
									<span className="text-muted-foreground text-xs">Status</span>
								</div>
							</div>

							{joinError && (
								<Alert variant="destructive" className="mb-4">
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>{joinError}</AlertDescription>
								</Alert>
							)}

							<form onSubmit={handleJoinDiscussion} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="displayName">Display Name</Label>
									<Input
										id="displayName"
										type="text"
										value={displayName}
										onChange={(e) => setDisplayName(e.target.value)}
										placeholder="Enter your name"
										maxLength={50}
										disabled={isJoining}
										required
									/>
									<p className="text-muted-foreground text-xs">
										This name will be visible to other participants
									</p>
								</div>

								<Button
									type="submit"
									className="w-full"
									disabled={isJoining || !displayName.trim()}
								>
									{isJoining ? "Joining..." : "Join Discussion"}
								</Button>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Main discussion interface
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto flex h-screen flex-col px-4 py-4">
				{/* Header */}
				<div className="mb-4 flex-shrink-0">
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div>
									<h1 className="font-semibold text-lg">{discussion.name}</h1>
									<div className="mt-1 flex items-center gap-4 text-muted-foreground text-sm">
										<div className="flex items-center gap-1">
											<Users className="h-3 w-3" />
											<span>{discussion.participantCount} participants</span>
										</div>
										<ConnectionStatus
											discussionId={discussionId}
											participantId={participantId}
											token={token}
										/>
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={handleLeaveDiscussion}
								>
									Leave
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Main Content */}
				<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-4">
					{/* Participant List - Hidden on mobile, shown on large screens */}
					<div className="hidden lg:block">
						<ParticipantList
							discussionId={discussionId}
							participantId={participantId}
							token={token || ""}
						/>
					</div>

					{/* Chat Area */}
					<div className="flex min-h-0 flex-col lg:col-span-2">
						<div className="mb-4 min-h-0 flex-1">
							<MessageHistory
								discussionId={discussionId}
								participantId={participantId}
								token={token || ""}
								initialMessages={messageHistory}
							/>
						</div>

						<div className="flex-shrink-0">
							<ParticipantChat
								discussionId={discussionId}
								participantId={participantId}
								displayName={displayName}
								sessionId={sessionId}
								token={token || ""}
							/>
						</div>
					</div>

					{/* Mobile Participant List - Show on mobile, hide on large screens */}
					<div className="lg:hidden">
						<ParticipantList
							discussionId={discussionId}
							participantId={participantId}
							token={token || ""}
						/>
					</div>

					{/* Right Sidebar - Reserved for future features */}
					<div className="hidden lg:block">
						<Card className="h-full">
							<CardContent className="p-4">
								<h3 className="mb-2 font-medium text-muted-foreground text-sm">
									Discussion Info
								</h3>
								<div className="space-y-2 text-sm">
									<div className="flex items-center justify-between">
										<span>Status</span>
										<span className="capitalize">Active</span>
									</div>
									<div className="flex items-center justify-between">
										<span>Participants</span>
										<span>{discussion.participantCount}</span>
									</div>
									{discussion.maxParticipants && (
										<div className="flex items-center justify-between">
											<span>Max Participants</span>
											<span>{discussion.maxParticipants}</span>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
