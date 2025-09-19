"use client";

import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";

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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import {
	AlertCircle,
	Clock,
	Eye,
	MessageCircle,
	MoreHorizontal,
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
	searchQuery = "",
	statusFilter = "all",
	onViewDiscussion,
	onInviteParticipants,
	onManageDiscussion,
}: {
	searchQuery?: string;
	statusFilter?: string;
	onViewDiscussion?: (discussionId: string) => void;
	onInviteParticipants?: (discussionId: string) => void;
	onManageDiscussion?: (discussionId: string) => void;
}) {
	const {
		data: discussions,
		isLoading,
		error,
	} = api.discussion.list.useQuery({});

	const filteredDiscussions = useMemo(() => {
		if (!discussions?.discussions) return [];

		let filtered = discussions.discussions;

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(discussion) =>
					discussion.name.toLowerCase().includes(query) ||
					discussion.description?.toLowerCase().includes(query) ||
					discussion.lesson?.title.toLowerCase().includes(query),
			);
		}

		// Filter by status
		if (statusFilter !== "all") {
			filtered = filtered.filter((discussion) => {
				if (statusFilter === "active") return discussion.isActive;
				if (statusFilter === "inactive") return !discussion.isActive;
				return true;
			});
		}

		return filtered;
	}, [discussions?.discussions, searchQuery, statusFilter]);

	if (isLoading) {
		return (
			<div className="space-y-4">
				{Array.from({ length: 3 }).map((_, i) => (
					<Card key={`skeleton-${i}`}>
						<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
							<div className="flex-1 space-y-2">
								<Skeleton className="h-5 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
							<div className="flex items-center gap-2">
								<Skeleton className="h-5 w-16" />
								<Skeleton className="h-8 w-8 rounded-md" />
							</div>
						</CardHeader>
						<CardContent className="pt-0">
							<div className="space-y-2">
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-2/3" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
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
			<Card className="border-dashed">
				<CardContent className="py-16 text-center">
					<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
						<MessageCircle className="h-10 w-10 text-muted-foreground" />
					</div>
					<CardTitle className="mt-6 text-xl">No discussions yet</CardTitle>
					<CardDescription className="mx-auto mt-2 max-w-md text-balance">
						Create your first discussion from a published lesson to start
						facilitating AI-guided Socratic conversations with participants.
					</CardDescription>
				</CardContent>
			</Card>
		);
	}

	if (filteredDiscussions.length === 0) {
		return (
			<Card className="border-dashed">
				<CardContent className="py-16 text-center">
					<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
						<MessageCircle className="h-10 w-10 text-muted-foreground" />
					</div>
					<CardTitle className="mt-6 text-xl">
						No matching discussions
					</CardTitle>
					<CardDescription className="mx-auto mt-2 max-w-md text-balance">
						Try adjusting your search query or check different status filters to
						find the discussions you're looking for.
					</CardDescription>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			{filteredDiscussions.map((discussion) => (
				<Card
					key={discussion.id}
					data-testid={`discussion-card-${discussion.id}`}
					className="transition-colors hover:bg-muted/50"
				>
					<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
						<div className="min-w-0 flex-1 space-y-1">
							<CardTitle className="font-semibold text-lg leading-tight tracking-tight">
								{discussion.name}
							</CardTitle>
							{discussion.description && (
								<CardDescription className="line-clamp-2 text-sm">
									{discussion.description}
								</CardDescription>
							)}
						</div>
						<div className="ml-4 flex shrink-0 items-center gap-2">
							<DiscussionStatusBadge
								status={discussion.isActive ? "active" : "inactive"}
							/>
							<DiscussionActions
								discussion={discussion}
								onInvite={onInviteParticipants}
								onManage={onManageDiscussion}
							/>
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{formatDistanceToNow(discussion.createdAt, {
									addSuffix: true,
								})}
							</span>
							<span className="flex items-center gap-1">
								<Users className="h-3 w-3" />
								{discussion.participantCount || 0} participants
							</span>
							{discussion.maxParticipants && (
								<span>Max: {discussion.maxParticipants}</span>
							)}
						</div>

						{discussion.lesson && (
							<div className="mt-2">
								<Badge variant="outline" className="text-xs">
									{discussion.lesson.title}
								</Badge>
							</div>
						)}
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
	onInvite,
	onManage,
}: {
	discussion: DiscussionData;
	onInvite?: (discussionId: string) => void;
	onManage?: (discussionId: string) => void;
}) {
	const hasActions = !discussion.isActive || discussion.isCreator;

	if (!hasActions) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="h-8 w-8">
					<MoreHorizontal className="h-4 w-4" />
					<span className="sr-only">Open menu</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{!discussion.isActive && (
					<DropdownMenuItem onClick={() => onInvite?.(discussion.id)}>
						<UserPlus className="mr-2 h-4 w-4" />
						Invite participants
					</DropdownMenuItem>
				)}
				{discussion.isCreator && (
					<DropdownMenuItem onClick={() => onManage?.(discussion.id)}>
						<Settings className="mr-2 h-4 w-4" />
						Manage discussion
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
