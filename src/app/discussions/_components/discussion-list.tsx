"use client";

import { formatDistanceToNow } from "date-fns";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import {
	AlertCircle,
	Clock,
	Eye,
	MessageCircle,
	Settings,
	UserPlus,
	Users,
} from "lucide-react";

// Type for discussion data
type DiscussionData = {
	id: string;
	name: string;
	description?: string | null;
	isActive: boolean;
	participantCount?: number;
	maxParticipants?: number | null;
	createdAt: Date;
	isCreator: boolean;
	lesson?: {
		title: string;
	} | null;
};

export function DiscussionList({
	onViewDiscussion,
	onInviteParticipants,
	onManageDiscussion,
}: {
	onViewDiscussion?: (discussionId: string) => void;
	onInviteParticipants?: (discussionId: string) => void;
	onManageDiscussion?: (discussionId: string) => void;
}) {
	const {
		data: discussions,
		isLoading,
		error,
	} = api.discussion.list.useQuery({});

	if (isLoading) {
		return (
			<Card>
				<CardContent className="p-6">
					<div className="space-y-4">
						<div key="discussion-skeleton-1" className="space-y-2">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
							<Skeleton className="h-3 w-1/4" />
						</div>
						<div key="discussion-skeleton-2" className="space-y-2">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
							<Skeleton className="h-3 w-1/4" />
						</div>
						<div key="discussion-skeleton-3" className="space-y-2">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
							<Skeleton className="h-3 w-1/4" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error loading discussions</AlertTitle>
				<AlertDescription>{error.message}</AlertDescription>
			</Alert>
		);
	}

	if (!discussions || discussions.discussions.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center">
					<MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
					<CardTitle className="mt-4">No discussions yet</CardTitle>
					<CardDescription className="mx-auto mt-2 max-w-sm">
						Create your first discussion from a published lesson to start
						facilitating AI-guided conversations.
					</CardDescription>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{discussions.discussions.map((discussion) => (
				<Card
					key={discussion.id}
					data-testid={`discussion-card-${discussion.id}`}
				>
					<CardContent className="p-6">
						<div className="flex items-start justify-between">
							<div className="min-w-0 flex-1">
								<div className="mb-2 flex items-center gap-3">
									<h3 className="truncate font-semibold text-lg">
										{discussion.name}
									</h3>
									<DiscussionStatusBadge
										status={discussion.isActive ? "active" : "inactive"}
									/>
								</div>

								{discussion.description && (
									<p className="mb-3 line-clamp-2 text-muted-foreground text-sm">
										{discussion.description}
									</p>
								)}

								<div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs">
									<span className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										Created{" "}
										{formatDistanceToNow(discussion.createdAt, {
											addSuffix: true,
										})}
									</span>
									<span className="flex items-center gap-1">
										<Users className="h-3 w-3" />
										{discussion.participantCount || 0} participants
									</span>
									{discussion.maxParticipants && (
										<span className="text-muted-foreground">
											Max: {discussion.maxParticipants}
										</span>
									)}
								</div>

								{discussion.lesson && (
									<div className="mt-3">
										<div className="mb-1 text-muted-foreground text-xs">
											Based on lesson
										</div>
										<Badge variant="outline" className="text-xs">
											{discussion.lesson.title}
										</Badge>
									</div>
								)}
							</div>

							<div className="ml-4 flex items-center gap-2">
								<DiscussionActions
									discussion={discussion}
									onView={onViewDiscussion}
									onInvite={onInviteParticipants}
									onManage={onManageDiscussion}
								/>
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function DiscussionStatusBadge({ status }: { status: "active" | "inactive" }) {
	const statusConfig = {
		active: { variant: "default" as const, label: "Active" },
		inactive: { variant: "secondary" as const, label: "Inactive" },
	};

	const config = statusConfig[status];

	return (
		<Badge variant={config.variant} className="text-xs">
			{config.label}
		</Badge>
	);
}

function DiscussionActions({
	discussion,
	onView,
	onInvite,
	onManage,
}: {
	discussion: DiscussionData;
	onView?: (discussionId: string) => void;
	onInvite?: (discussionId: string) => void;
	onManage?: (discussionId: string) => void;
}) {
	return (
		<div className="flex items-center gap-1">
			{!discussion.isActive && (
				<Button
					variant="ghost"
					size="icon"
					onClick={() => onInvite?.(discussion.id)}
					title="Invite participants"
				>
					<UserPlus className="h-4 w-4" />
				</Button>
			)}

			{discussion.isCreator && (
				<Button
					variant="ghost"
					size="icon"
					className="cursor-pointer"
					onClick={() => onManage?.(discussion.id)}
					title="Manage discussion"
				>
					<Settings className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
}
