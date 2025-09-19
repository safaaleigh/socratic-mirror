"use client";

import { useSession } from "next-auth/react";
import { notFound, redirect } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthenticatedChatContainer } from "@/components/chat";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
	DiscussionHeader,
	DiscussionStats,
	ParticipantsList,
	EmptyDiscussionState,
} from "@/components/discussion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { AlertCircle, BookOpen } from "lucide-react";
import { InviteParticipantsModal } from "../_components/invite-participants-modal";

export default function DiscussionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const [paramsResolved, setParamsResolved] = useState<{ id: string } | null>(
		null,
	);

	// Resolve params on mount
	useEffect(() => {
		params.then(setParamsResolved);
	}, [params]);
	const { data: session, status } = useSession();
	const [inviteModalOpen, setInviteModalOpen] = useState(false);

	const {
		data: discussion,
		isLoading,
		error,
	} = api.discussion.getById.useQuery(
		{
			id: paramsResolved?.id ?? "",
		},
		{
			enabled: !!paramsResolved?.id,
		},
	);

	const { data: participants } = api.discussion.getParticipants.useQuery(
		{
			id: paramsResolved?.id ?? "",
		},
		{
			enabled: !!paramsResolved?.id,
		},
	);

	const utils = api.useUtils();

	const joinDiscussionMutation = api.discussion.join.useMutation({
		onSuccess: () => {
			if (paramsResolved?.id) {
				void utils.discussion.getById.invalidate({ id: paramsResolved.id });
				void utils.discussion.getParticipants.invalidate({
					id: paramsResolved.id,
				});
			}
		},
	});

	const leaveDiscussionMutation = api.discussion.leave.useMutation({
		onSuccess: () => {
			if (paramsResolved?.id) {
				void utils.discussion.getById.invalidate({ id: paramsResolved.id });
				void utils.discussion.getParticipants.invalidate({
					id: paramsResolved.id,
				});
			}
		},
	});

	const aiFacilitatorMutation = api.aiFacilitator.triggerResponse.useMutation({
		onSuccess: (data) => {
			console.log("AI Facilitator triggered successfully:", data.message);
			// Invalidate message queries to load the new AI message
			if (paramsResolved?.id) {
				void utils.participant.getMessageHistory.invalidate({
					discussionId: paramsResolved.id
				});
				void utils.message.list.invalidate({
					discussionId: paramsResolved.id
				});
			}
		},
		onError: (error) => {
			console.error("AI Facilitator error:", error.message);
			alert(`AI Facilitator Error: ${error.message}`);
		},
	});

	if (status === "loading" || isLoading || !paramsResolved) {
		return (
			<DashboardLayout>
				<div className="space-y-4">
					<Skeleton className="h-8 w-1/2" />
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-64 w-full" />
				</div>
			</DashboardLayout>
		);
	}

	if (status === "unauthenticated") {
		redirect("/auth/signin");
	}

	if (error?.data?.code === "NOT_FOUND" || !discussion) {
		notFound();
	}

	if (error) {
		return (
			<DashboardLayout>
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			</DashboardLayout>
		);
	}

	const breadcrumbItems = [
		{ label: "Discussions", href: "/discussions" },
		{ label: discussion.name, isCurrentPage: true },
	];

	const participantsList = participants?.participants || [];
	const isParticipant = participantsList?.some(
		(p) => p.userId === session?.user?.id,
	);
	const isCreator = discussion.creatorId === session?.user?.id;
	const canJoin =
		discussion.isActive &&
		!isParticipant &&
		(!discussion.maxParticipants ||
			(participantsList?.length ?? 0) < discussion.maxParticipants);

	const handleJoin = () => {
		if (paramsResolved?.id) {
			joinDiscussionMutation.mutate({ discussionId: paramsResolved.id });
		}
	};

	const handleLeave = () => {
		if (confirm("Are you sure you want to leave this discussion?")) {
			if (paramsResolved?.id) {
				leaveDiscussionMutation.mutate({ discussionId: paramsResolved.id });
			}
		}
	};

	const handleTriggerAIFacilitator = () => {
		if (paramsResolved?.id) {
			aiFacilitatorMutation.mutate({
				discussionId: paramsResolved.id,
				forcePrompt: true,
			});
		}
	};

	return (
		<>
			<DashboardLayout breadcrumbItems={breadcrumbItems}>
				{/* Mobile: Full height layout */}
				<div className="flex h-[calc(100vh-8rem)] flex-col lg:hidden">
					{/* Discussion Header */}
					<div className="mb-3">
						<DiscussionHeader
							name={discussion.name}
							description={discussion.description}
							isActive={discussion.isActive}
							createdAt={discussion.createdAt}
							isCreator={isCreator}
							isParticipant={isParticipant}
							canJoin={canJoin}
							isJoining={joinDiscussionMutation.isPending}
							isLeaving={leaveDiscussionMutation.isPending}
							onBack={() => window.history.back()}
							onInvite={() => setInviteModalOpen(true)}
							onJoin={handleJoin}
							onLeave={handleLeave}
						/>
					</div>

					{/* Messages Area - Takes remaining space */}
					<div className="flex flex-1 flex-col overflow-hidden">
						{isParticipant ? (
							<AuthenticatedChatContainer
								discussionId={paramsResolved?.id ?? ""}
								userId={session?.user?.id ?? ""}
								displayName={session?.user?.name ?? "User"}
								className="h-full"
								isMobile={true}
								showAIFacilitator={isCreator}
								onTriggerAI={handleTriggerAIFacilitator}
								isTriggeringAI={aiFacilitatorMutation.isPending}
							/>
						) : (
							<EmptyDiscussionState
								isParticipant={isParticipant}
								canJoin={canJoin}
								onJoin={canJoin ? handleJoin : undefined}
								icon="eye"
							/>
						)}
					</div>
				</div>

				{/* Desktop: Grid layout */}
				<div className="hidden h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid lg:grid-cols-4">
					{/* Main Discussion Area */}
					<div className="flex flex-col lg:col-span-3">
						{/* Discussion Header */}
						<div className="mb-4">
							<DiscussionHeader
								name={discussion.name}
								description={discussion.description}
								isActive={discussion.isActive}
								createdAt={discussion.createdAt}
								isCreator={isCreator}
								isParticipant={isParticipant}
								canJoin={canJoin}
								isJoining={joinDiscussionMutation.isPending}
								isLeaving={leaveDiscussionMutation.isPending}
								onBack={() => window.history.back()}
								onInvite={() => setInviteModalOpen(true)}
								onJoin={handleJoin}
								onLeave={handleLeave}
							/>
						</div>

						{/* Messages Area */}
						<div className="flex flex-1 flex-col overflow-hidden">
							{isParticipant ? (
								<AuthenticatedChatContainer
									discussionId={paramsResolved?.id ?? ""}
									userId={session?.user?.id ?? ""}
									displayName={session?.user?.name ?? "User"}
									className="h-full max-h-[600px]"
									showAIFacilitator={isCreator}
									onTriggerAI={handleTriggerAIFacilitator}
									isTriggeringAI={aiFacilitatorMutation.isPending}
								/>
							) : (
								<EmptyDiscussionState
									isParticipant={isParticipant}
									canJoin={canJoin}
									onJoin={canJoin ? handleJoin : undefined}
									icon="eye"
								/>
							)}
						</div>
					</div>

					{/* Sidebar */}
					<div className="space-y-4">
						{/* Lesson Info */}
						{discussion.lesson && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-sm">
										<BookOpen className="h-4 w-4" />
										Based on Lesson
									</CardTitle>
								</CardHeader>
								<CardContent>
									<h4 className="mb-2 font-medium">
										{discussion.lesson.title}
									</h4>
									{discussion.lesson.description && (
										<p className="text-muted-foreground text-xs">
											{discussion.lesson.description}
										</p>
									)}
								</CardContent>
							</Card>
						)}

						{/* Discussion Stats */}
						<DiscussionStats
							participantCount={participantsList.length}
							messageCount={undefined}
							duration={undefined}
						/>

						{/* Participants List */}
						<ParticipantsList
							participants={participantsList}
							creatorId={discussion.creatorId}
							maxHeight="400px"
						/>
					</div>
				</div>
			</DashboardLayout>

			{/* Invite Modal */}
			{paramsResolved?.id && (
				<InviteParticipantsModal
					discussionId={paramsResolved.id}
					discussionTitle={discussion.name}
					isOpen={inviteModalOpen}
					onOpenChange={setInviteModalOpen}
				/>
			)}
		</>
	);
}