"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface NameEntryFormProps {
	discussionId: string;
	token: string;
}

export function NameEntryForm({ discussionId, token }: NameEntryFormProps) {
	const [displayName, setDisplayName] = useState("");
	const [sessionId] = useState(() => {
		// Generate a unique session ID for this participant session
		if (typeof window !== "undefined") {
			// Check if we have an existing session ID in session storage
			const existingSessionId = sessionStorage.getItem(
				`participant_session_${discussionId}`,
			);
			if (existingSessionId) {
				return existingSessionId;
			}

			// Generate new session ID
			const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			sessionStorage.setItem(
				`participant_session_${discussionId}`,
				newSessionId,
			);
			return newSessionId;
		}
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	});

	const router = useRouter();

	const joinMutation = api.participant.join.useMutation({
		onSuccess: (data) => {
			// Store participant info in session storage for the discussion page
			if (typeof window !== "undefined") {
				sessionStorage.setItem(
					`participant_${discussionId}`,
					JSON.stringify({
						participantId: data.participant.id,
						displayName: data.participant.displayName,
						joinedAt: data.participant.joinedAt,
					}),
				);
			}

			// Redirect to participant discussion page
			router.push(`/discussion/${discussionId}/participant`);
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!displayName.trim()) {
			return;
		}

		// Get client IP address for tracking (optional)
		let ipAddress: string | undefined;
		try {
			// In a real implementation, you might want to get this from headers
			// For now, we'll leave it undefined as it's optional
			ipAddress = undefined;
		} catch {
			// IP detection failed, continue without it
		}

		joinMutation.mutate({
			discussionId,
			displayName: displayName.trim(),
			sessionId,
			ipAddress,
		});
	};

	const isValidName =
		displayName.trim().length >= 1 && displayName.trim().length <= 50;
	const isSubmitDisabled = !isValidName || joinMutation.isPending;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="displayName">Your Name *</Label>
				<Input
					id="displayName"
					type="text"
					placeholder="Enter your display name"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					maxLength={50}
					required
					disabled={joinMutation.isPending}
				/>
				<div className="flex justify-between text-muted-foreground text-xs">
					<span>This name will be visible to other participants</span>
					<span>{displayName.length}/50</span>
				</div>
			</div>

			{joinMutation.error && (
				<Alert variant="destructive">
					<AlertDescription>
						{joinMutation.error.message === "Discussion not found"
							? "This discussion could not be found. It may have been deleted."
							: joinMutation.error.message === "Discussion has ended"
								? "This discussion has ended and is no longer accepting participants."
								: joinMutation.error.message === "Discussion is at capacity"
									? "This discussion is currently full. Please try again later."
									: `Unable to join discussion: ${joinMutation.error.message}`}
					</AlertDescription>
				</Alert>
			)}

			<Button type="submit" className="w-full" disabled={isSubmitDisabled}>
				{joinMutation.isPending ? "Joining Discussion..." : "Join Discussion"}
			</Button>

			<div className="text-center text-muted-foreground text-xs">
				By joining, you agree to participate respectfully and follow the
				discussion guidelines.
			</div>
		</form>
	);
}
