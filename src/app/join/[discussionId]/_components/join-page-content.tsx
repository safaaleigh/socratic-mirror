"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { useSearchParams } from "next/navigation";
import { InvitationError } from "./invitation-error";
import { NameEntryForm } from "./name-entry-form";

interface JoinPageContentProps {
	discussionId: string;
}

export function JoinPageContent({ discussionId }: JoinPageContentProps) {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	// If no token provided, show error
	if (!token) {
		return (
			<InvitationError
				type="invalid"
				message="This invitation link is missing a valid token. Please check the link and try again."
			/>
		);
	}

	// Validate the invitation token and get discussion info
	const {
		data: validationResult,
		isLoading: isValidating,
		error: validationError,
	} = api.participant.validateInvitation.useQuery({
		discussionId,
		token,
	});

	// Show loading state while validating
	if (isValidating) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-4 w-64" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-32" />
					</div>
				</CardContent>
			</Card>
		);
	}

	// Handle validation errors
	if (validationError) {
		return (
			<InvitationError
				type="network"
				message="Unable to verify invitation. Please check your connection and try again."
			/>
		);
	}

	// Handle invalid invitations
	if (!validationResult?.valid) {
		const errorType = validationResult?.error?.includes("expired")
			? ("expired" as const)
			: validationResult?.error?.includes("capacity")
				? ("full" as const)
				: validationResult?.error?.includes("ended")
					? ("ended" as const)
					: ("invalid" as const);

		return (
			<InvitationError
				type={errorType}
				message={
					validationResult?.error || "This invitation is no longer valid."
				}
			/>
		);
	}

	// Show discussion info and name entry form for valid invitations
	const { discussion } = validationResult;

	if (!discussion) {
		return (
			<InvitationError
				type="invalid"
				message="Discussion information could not be loaded. Please try again."
			/>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Join Discussion</CardTitle>
				<CardDescription>
					You&apos;ve been invited to participate in this discussion
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Discussion Information */}
				<div className="space-y-3">
					<div>
						<h3 className="font-medium text-muted-foreground text-sm">
							Discussion
						</h3>
						<p className="font-semibold">{discussion.title}</p>
					</div>

					<div className="flex items-center justify-between text-muted-foreground text-sm">
						<span>
							{discussion.participantCount} participant
							{discussion.participantCount !== 1 ? "s" : ""} joined
						</span>
						{discussion.maxParticipants && (
							<span>
								Capacity: {discussion.participantCount}/
								{discussion.maxParticipants}
							</span>
						)}
					</div>

					{discussion.status === "active" && (
						<Alert>
							<AlertDescription>
								This discussion is currently active. You can join and start
								participating right away.
							</AlertDescription>
						</Alert>
					)}
				</div>

				{/* Name Entry Form */}
				<NameEntryForm discussionId={discussionId} token={token} />
			</CardContent>
		</Card>
	);
}
