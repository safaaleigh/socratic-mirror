"use client";

import { useSession } from "next-auth/react";
import { notFound, redirect } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthenticatedChatContainer } from "@/components/chat";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import {
	AlertCircle,
	ArrowLeft,
	BookOpen,
	Clock,
	Eye,
	MessageCircle,
	Settings,
	UserPlus,
	Users,
} from "lucide-react";
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
		{ label: "Dashboard", href: "/dashboard" },
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
				<div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-6 lg:grid-cols-4">
					{/* Main Discussion Area */}
					<div className="flex flex-col lg:col-span-3">
						{/* Discussion Header */}
						<Card className="mb-4">
							<CardHeader>
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0 flex-1">
										<div className="mb-2 flex items-center gap-3">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => window.history.back()}
											>
												<ArrowLeft className="h-4 w-4" />
											</Button>
											<div className="min-w-0 max-w-md flex-1 overflow-hidden">
												<h1 className="truncate font-bold text-xl">
													{discussion.name}
												</h1>
												<div className="mt-1 flex items-center gap-2">
													<Badge
														variant={
															discussion.isActive ? "default" : "secondary"
														}
													>
														{discussion.isActive ? "Active" : "Inactive"}
													</Badge>
													<span className="text-muted-foreground text-xs">
														Created{" "}
														{new Date(
															discussion.createdAt,
														).toLocaleDateString()}
													</span>
												</div>
											</div>
										</div>

										{discussion.description && (
											<p className="text-muted-foreground text-sm">
												{discussion.description}
											</p>
										)}
									</div>

									<div className="flex shrink-0 items-center gap-2">
										{isCreator && (
											<>
												<Button
													variant="outline"
													size="sm"
													onClick={() => setInviteModalOpen(true)}
												>
													<UserPlus className="mr-2 h-4 w-4" />
													Invite
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => handleTriggerAIFacilitator()}
													disabled={aiFacilitatorMutation.isPending}
												>
													{aiFacilitatorMutation.isPending ? (
														"🤖 Sending..."
													) : (
														<>🤖 AI Facilitator</>
													)}
												</Button>
											</>
										)}

										{canJoin && (
											<Button
												variant="default"
												size="sm"
												onClick={handleJoin}
												disabled={joinDiscussionMutation.isPending}
											>
												{joinDiscussionMutation.isPending
													? "Joining..."
													: "Join Discussion"}
											</Button>
										)}

										{isParticipant && !isCreator && (
											<Button
												variant="outline"
												size="sm"
												onClick={handleLeave}
												disabled={leaveDiscussionMutation.isPending}
											>
												{leaveDiscussionMutation.isPending
													? "Leaving..."
													: "Leave"}
											</Button>
										)}

										{isCreator && (
											<Button variant="ghost" size="icon">
												<Settings className="h-4 w-4" />
											</Button>
										)}
									</div>
								</div>
							</CardHeader>
						</Card>

						{/* Messages Area */}
						<div className="flex flex-1 flex-col overflow-hidden">
							{isParticipant ? (
								<AuthenticatedChatContainer
									discussionId={paramsResolved?.id ?? ""}
									userId={session?.user?.id ?? ""}
									displayName={session?.user?.name ?? "User"}
									className="h-full"
								/>
							) : (
								<div className="flex flex-1 items-center justify-center p-4">
									<Card>
										<CardContent className="py-12 text-center">
											<Eye className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
											<h3 className="mb-2 font-semibold">
												Join to participate
											</h3>
											<p className="mb-4 text-muted-foreground text-sm">
												You need to join this discussion to view and send
												messages.
											</p>
											{canJoin && (
												<Button onClick={handleJoin}>Join Discussion</Button>
											)}
										</CardContent>
									</Card>
								</div>
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
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">Discussion Stats</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex items-center justify-between text-sm">
									<span className="flex items-center gap-2">
										<Users className="h-4 w-4" />
										Participants
									</span>
									<span>{participantsList.length}</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="flex items-center gap-2">
										<MessageCircle className="h-4 w-4" />
										Messages
									</span>
									<span>-</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="flex items-center gap-2">
										<Clock className="h-4 w-4" />
										Duration
									</span>
									<span>-</span>
								</div>
							</CardContent>
						</Card>

						{/* Participants List */}
						{participantsList.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="text-sm">Participants</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									{participantsList.map((participant) => (
										<div
											key={participant.id}
											className="flex items-center gap-2"
										>
											<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
												<span className="text-xs">
													{participant.user?.name?.charAt(0)?.toUpperCase() ||
														"U"}
												</span>
											</div>
											<span className="truncate text-sm">
												{participant.user?.name || "Unknown User"}
											</span>
											{participant.role === "MODERATOR" && (
												<Badge variant="secondary" className="text-xs">
													Mod
												</Badge>
											)}
											{participant.userId === discussion.creatorId && (
												<Badge variant="outline" className="text-xs">
													Creator
												</Badge>
											)}
										</div>
									))}
								</CardContent>
							</Card>
						)}
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
