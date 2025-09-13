"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
// import { useToast } from "@/components/ui/use-toast"; // TODO: Add toast component
import { api } from "@/trpc/react";

// Types based on contract specifications
type InvitationValidation = {
	valid: boolean;
	discussion?: {
		id: string;
		name: string;
		participantCount: number;
		maxParticipants: number | null;
	};
	reason?: string;
};

type InvitationDetails = {
	id: string;
	type: string;
	targetId: string;
	sender: {
		id: string;
		name: string | null;
		email: string;
	};
	message: string | null;
	expiresAt: Date;
};

// Validation schema for participant name
const participantNameSchema = z
	.string()
	.min(1, "Name is required")
	.max(50, "Name must be 50 characters or less");

interface InvitationTokenPageProps {
	params: Promise<{
		token: string;
	}>;
}

export default function InvitationTokenPage({
	params,
}: InvitationTokenPageProps) {
	const [token, setToken] = useState<string | null>(null);

	// In Next.js 15, params is a Promise that needs to be awaited
	useEffect(() => {
		const resolveParams = async () => {
			const resolvedParams = await params;
			setToken(resolvedParams.token);
		};
		resolveParams();
	}, [params]);
	const router = useRouter();
	// const { toast } = useToast(); // TODO: Add toast component

	// Component state
	const [participantName, setParticipantName] = useState("");
	const [isJoining, setIsJoining] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);

	// tRPC queries and mutations using unified system
	const validationQuery = api.unifiedInvitation.validate.useQuery(
		{ token: token || "" },
		{
			enabled: !!token,
			retry: (failureCount, error) => {
				// Don't retry on validation errors (invalid token format, etc.)
				if (error?.data?.code === "BAD_REQUEST") return false;
				return failureCount < 2;
			},
		},
	);

	const joinMutation = api.participant.join.useMutation({
		onSuccess: (data) => {
			// TODO: Add toast notification
			// toast({
			// 	title: "Successfully joined discussion!",
			// 	description: `Welcome, ${data.participant.displayName}!`,
			// });

			// Redirect to discussion participant view with token parameter
			router.push(`/discussion/${data.participant.discussionId}/participant?token=${token}`);
		},
		onError: (error) => {
			// TODO: Add toast notification
			// toast({
			// 	title: "Failed to join discussion",
			// 	description: error.message,
			// 	variant: "destructive",
			// });
			console.error("Failed to join discussion:", error);
			setIsJoining(false);
		},
	});

	// Handle form submission
	const handleJoinDiscussion = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validate participant name
		try {
			participantNameSchema.parse(participantName);
			setValidationError(null);
		} catch (error) {
			if (error instanceof z.ZodError) {
				setValidationError(error.errors[0]?.message || "Invalid name");
				return;
			}
		}

		if (!validationQuery.data?.valid || !validationQuery.data.discussion) {
			// TODO: Add toast notification
			// toast({
			// 	title: "Cannot join discussion",
			// 	description: "This invitation is no longer valid",
			// 	variant: "destructive",
			// });
			console.error("Cannot join discussion: invitation is no longer valid");
			return;
		}

		setIsJoining(true);

		// Generate session ID for anonymous participant
		const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		joinMutation.mutate({
			discussionId: validationQuery.data.discussion.id,
			displayName: participantName.trim(),
			sessionId,
			ipAddress: "127.0.0.1", // In production, this would be the actual client IP
		});
	};

	// Loading state (token not resolved or validation loading)
	if (!token || validationQuery.isLoading) {
		return (
			<div className="container mx-auto max-w-md py-8">
				<Card>
					<CardHeader>
						<Skeleton className="h-6 w-3/4" />
						<Skeleton className="h-4 w-full" />
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Validation error or invalid invitation
	if (validationQuery.error || !validationQuery.data?.valid) {
		const errorReason =
			validationQuery.data?.reason ||
			validationQuery.error?.message ||
			"Unknown error";

		let userMessage = "This invitation link is not valid.";
		let helpText =
			"Please check the link and try again, or contact the person who sent you the invitation.";

		// Provide specific error messages based on the error reason
		if (errorReason.includes("expired")) {
			userMessage = "This invitation has expired.";
			helpText =
				"Invitation links have an expiration date. Please ask for a new invitation link.";
		} else if (errorReason.includes("not found")) {
			userMessage = "This invitation link was not found.";
			helpText =
				"The link may be incorrect or the invitation may have been cancelled.";
		} else if (errorReason.includes("full")) {
			userMessage = "This discussion is currently full.";
			helpText =
				"The discussion has reached its maximum number of participants. Please try again later.";
		} else if (errorReason.includes("not active")) {
			userMessage = "This discussion is no longer active.";
			helpText = "The discussion has been closed by the organizer.";
		} else if (errorReason.includes("cancelled")) {
			userMessage = "This invitation has been cancelled.";
			helpText = "The invitation was cancelled by the person who sent it.";
		}

		return (
			<div className="container mx-auto max-w-md py-8">
				<Card>
					<CardHeader>
						<CardTitle className="text-red-600">
							Unable to Access Discussion
						</CardTitle>
						<CardDescription>{userMessage}</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-gray-600 text-sm">{helpText}</p>

						{validationQuery.error && (
							<details className="mt-4">
								<summary className="cursor-pointer text-gray-500 text-xs">
									Technical Details
								</summary>
								<p className="mt-2 font-mono text-gray-400 text-xs">
									{errorReason}
								</p>
							</details>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	// Get invitation and discussion details for display
	const discussion = validationQuery.data?.discussion;
	const tokenInfo = validationQuery.data?.token;

	// This should never happen given our validation logic above, but TypeScript needs the check
	if (!discussion) {
		return (
			<div className="container mx-auto max-w-md py-8">
				<Card>
					<CardHeader>
						<CardTitle className="text-red-600">Error</CardTitle>
						<CardDescription>Discussion information unavailable</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-md py-8">
			<Card>
				<CardHeader>
					<CardTitle>You're invited to join a discussion</CardTitle>
					<CardDescription>{discussion.name}</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					{/* Invitation details */}
					{tokenInfo && (
						<div className="space-y-2 text-sm">
							{/* Show sender info for database tokens */}
							{tokenInfo.type === 'database' && 'sender' in tokenInfo && (
								<div>
									<span className="font-medium">Invited by:</span>{" "}
									{tokenInfo.sender?.name || tokenInfo.sender?.email || "Unknown"}
								</div>
							)}

							{/* Show message for database tokens */}
							{tokenInfo.type === 'database' && 'message' in tokenInfo && tokenInfo.message && (
								<div>
									<span className="font-medium">Message:</span>{" "}
									<span className="italic">"{tokenInfo.message}"</span>
								</div>
							)}

							<div className="text-gray-600">
								<span className="font-medium">Expires:</span>{" "}
								{new Date(tokenInfo.expiresAt).toLocaleDateString()}
							</div>

							{/* Show token type indicator */}
							<div className="text-gray-500 text-xs">
								{tokenInfo.type === 'database' ? 'Secure invitation' : 'Quick share link'}
							</div>
						</div>
					)}

					{/* Discussion capacity info */}
					<div className="text-gray-600 text-sm">
						{discussion.maxParticipants ? (
							<>
								{discussion.participantCount} of {discussion.maxParticipants}{" "}
								participants
								{discussion.maxParticipants - discussion.participantCount ===
									1 && (
									<span className="ml-2 text-orange-600">
										• Last spot available!
									</span>
								)}
							</>
						) : (
							<>{discussion.participantCount} participants</>
						)}
					</div>

					{/* Join form */}
					<form onSubmit={handleJoinDiscussion} className="space-y-4">
						<div>
							<Label htmlFor="participantName">Your name</Label>
							<Input
								id="participantName"
								type="text"
								placeholder="Enter your name to join"
								value={participantName}
								onChange={(e) => setParticipantName(e.target.value)}
								maxLength={50}
								required
								disabled={isJoining}
							/>
							{validationError && (
								<p className="mt-1 text-red-600 text-sm">{validationError}</p>
							)}
							<p className="mt-1 text-gray-500 text-xs">
								This will be your display name in the discussion
							</p>
						</div>

						<Button
							type="submit"
							className="w-full"
							disabled={isJoining || !participantName.trim()}
						>
							{isJoining ? "Joining..." : "Join Discussion"}
						</Button>
					</form>
				</CardContent>

				<CardFooter>
					<p className="w-full text-center text-gray-500 text-xs">
						You'll be able to participate in the discussion immediately after
						joining
					</p>
				</CardFooter>
			</Card>
		</div>
	);
}
