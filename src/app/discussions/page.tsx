"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Plus } from "lucide-react";
import { CreateDiscussionForm } from "./_components/create-discussion-form";
import { DiscussionList } from "./_components/discussion-list";
import { InviteParticipantsModal } from "./_components/invite-participants-modal";

type ViewMode = "list" | "create";

export default function DiscussionsPage() {
	const { data: session, status } = useSession();
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [inviteModalOpen, setInviteModalOpen] = useState(false);
	const [selectedDiscussionId, setSelectedDiscussionId] = useState<
		string | null
	>(null);
	const [selectedDiscussionTitle, setSelectedDiscussionTitle] = useState<
		string | null
	>(null);

	if (status === "loading") {
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

	const handleCreateSuccess = () => {
		setViewMode("list");
	};

	const handleCreateCancel = () => {
		setViewMode("list");
	};

	const handleViewDiscussion = (discussionId: string) => {
		// Navigate to individual discussion view
		window.location.href = `/discussions/${discussionId}`;
	};

	const handleInviteParticipants = (
		discussionId: string,
		discussionTitle?: string,
	) => {
		setSelectedDiscussionId(discussionId);
		setSelectedDiscussionTitle(discussionTitle || null);
		setInviteModalOpen(true);
	};

	const handleManageDiscussion = (discussionId: string) => {
		// For now, redirect to the discussion view for management
		window.location.href = `/discussions/${discussionId}`;
	};

	const breadcrumbItems = [{ label: "Discussions", isCurrentPage: true }];

	return (
		<>
			<DashboardLayout breadcrumbItems={breadcrumbItems}>
				<div className="mb-8">
					<h1 className="font-bold text-3xl">Discussion Management</h1>
					<p className="mt-2 text-muted-foreground">
						Create and manage AI-facilitated Socratic discussions based on your
						lessons.
					</p>
				</div>

				<div className="grid gap-6">
					{viewMode === "list" && (
						<>
							{/* Header with Create Button */}
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 className="font-semibold text-xl">Your Discussions</h2>
									<p className="text-muted-foreground text-sm">
										Manage active discussions and create new ones from your
										published lessons
									</p>
								</div>

								<Button onClick={() => setViewMode("create")}>
									<Plus className="mr-2 h-4 w-4" />
									Create New Discussion
								</Button>
							</div>

							{/* Discussion List */}
							<DiscussionList
								onViewDiscussion={handleViewDiscussion}
								onInviteParticipants={(discussionId) => {
									// We'll need to get the title from the discussion data
									handleInviteParticipants(discussionId, "Discussion");
								}}
								onManageDiscussion={handleManageDiscussion}
							/>

							{/* Status Guide */}
							<div className="rounded-lg bg-muted/50 p-4">
								<h3 className="mb-3 font-medium text-sm">
									Discussion Status Guide
								</h3>
								<div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="text-xs">
											Planning
										</Badge>
										<span className="text-muted-foreground">
											Setting up, inviting participants
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="default" className="text-xs">
											Active
										</Badge>
										<span className="text-muted-foreground">
											Discussion in progress
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="secondary" className="text-xs">
											Completed
										</Badge>
										<span className="text-muted-foreground">
											Discussion finished
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="destructive" className="text-xs">
											Cancelled
										</Badge>
										<span className="text-muted-foreground">
											Discussion was cancelled
										</span>
									</div>
								</div>
							</div>

							{/* Tips */}
							<div className="rounded-lg border-blue-500 border-l-4 bg-blue-50 p-4 dark:bg-blue-950/30">
								<h3 className="mb-2 flex items-center gap-2 font-medium text-blue-800 text-sm dark:text-blue-200">
									<MessageCircle className="h-4 w-4" />
									Tips for Great Discussions
								</h3>
								<ul className="space-y-1 text-blue-700 text-xs dark:text-blue-300">
									<li>
										• Start with a clear, engaging question from your lesson
									</li>
									<li>• Invite 4-8 participants for optimal engagement</li>
									<li>• Let the AI facilitator guide the Socratic method</li>
									<li>
										• Encourage participants to build on each other's ideas
									</li>
								</ul>
							</div>
						</>
					)}

					{viewMode === "create" && (
						<CreateDiscussionForm
							onSuccess={handleCreateSuccess}
							onCancel={handleCreateCancel}
						/>
					)}
				</div>
			</DashboardLayout>

			{/* Invite Modal */}
			{selectedDiscussionId && (
				<InviteParticipantsModal
					discussionId={selectedDiscussionId}
					discussionTitle={selectedDiscussionTitle || undefined}
					isOpen={inviteModalOpen}
					onOpenChange={(open) => {
						setInviteModalOpen(open);
						if (!open) {
							setSelectedDiscussionId(null);
							setSelectedDiscussionTitle(null);
						}
					}}
				/>
			)}
		</>
	);
}
