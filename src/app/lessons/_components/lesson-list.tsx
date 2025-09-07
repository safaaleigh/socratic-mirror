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
	Archive,
	BookOpen,
	CheckCircle2,
	Edit2,
	Trash2,
} from "lucide-react";

export function LessonList({
	onEditLesson,
}: { onEditLesson?: (lessonId: string) => void }) {
	const { data: lessons, isLoading, error } = api.lesson.list.useQuery();

	if (isLoading) {
		return (
			<Card>
				<CardContent className="p-6">
					<div className="space-y-4">
						{[...Array(3)].map((_, i) => (
							<div key={i} className="space-y-2">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-1/2" />
								<Skeleton className="h-3 w-1/4" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Error loading lessons</AlertTitle>
				<AlertDescription>{error.message}</AlertDescription>
			</Alert>
		);
	}

	if (!lessons || lessons.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center">
					<BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
					<CardTitle className="mt-4">No lessons yet</CardTitle>
					<CardDescription className="mx-auto mt-2 max-w-sm">
						Get started by creating your first lesson. Lessons guide
						AI-facilitated discussions and can be reused across multiple
						sessions.
					</CardDescription>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{lessons.map((lesson) => (
				<Card key={lesson.id} data-testid={`lesson-card-${lesson.id}`}>
					<CardContent className="p-6">
						<div className="flex items-start justify-between">
							<div className="min-w-0 flex-1">
								<div className="mb-2 flex items-center gap-3">
									<h3 className="truncate font-semibold text-lg">
										{lesson.title}
									</h3>
									<LessonStatusBadge status={lesson.status} />
								</div>

								{lesson.description && (
									<p className="mb-3 line-clamp-2 text-muted-foreground text-sm">
										{lesson.description}
									</p>
								)}

								<div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs">
									<span>
										Created{" "}
										{formatDistanceToNow(lesson.createdAt, { addSuffix: true })}
									</span>
									<span>
										Updated{" "}
										{formatDistanceToNow(lesson.updatedAt, { addSuffix: true })}
									</span>
									{lesson.facilitationStyle && (
										<span className="capitalize">
											{lesson.facilitationStyle} style
										</span>
									)}
									{lesson.suggestedDuration && (
										<span>{lesson.suggestedDuration} min</span>
									)}
								</div>

								{lesson.objectives && lesson.objectives.length > 0 && (
									<div className="mt-3">
										<div className="mb-1 text-muted-foreground text-xs">
											Objectives ({lesson.objectives.length})
										</div>
										<div className="flex flex-wrap gap-1">
											{lesson.objectives
												.slice(0, 3)
												.map((objective: string, index: number) => (
													<Badge key={index} variant="secondary">
														{objective}
													</Badge>
												))}
											{lesson.objectives.length > 3 && (
												<Badge variant="outline">
													+{lesson.objectives.length - 3} more
												</Badge>
											)}
										</div>
									</div>
								)}
							</div>

							<div className="ml-4 flex items-center gap-2">
								<LessonActions lesson={lesson} onEdit={onEditLesson} />
							</div>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

function LessonStatusBadge({
	status,
}: { status: "draft" | "published" | "archived" }) {
	const statusConfig = {
		draft: { variant: "outline" as const, icon: Edit2 },
		published: { variant: "default" as const, icon: CheckCircle2 },
		archived: { variant: "secondary" as const, icon: Archive },
	};

	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<Badge variant={config.variant} className="gap-1">
			<Icon className="h-3 w-3" />
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</Badge>
	);
}

function LessonActions({
	lesson,
	onEdit,
}: { lesson: any; onEdit?: (lessonId: string) => void }) {
	const utils = api.useUtils();

	const publishMutation = api.lesson.publish.useMutation({
		onSuccess: () => {
			void utils.lesson.list.invalidate();
		},
	});

	const archiveMutation = api.lesson.archive.useMutation({
		onSuccess: () => {
			void utils.lesson.list.invalidate();
		},
	});

	const deleteMutation = api.lesson.delete.useMutation({
		onSuccess: () => {
			void utils.lesson.list.invalidate();
		},
	});

	const handlePublish = () => {
		if (lesson.canPublish) {
			publishMutation.mutate({ id: lesson.id });
		}
	};

	const handleArchive = () => {
		if (lesson.canArchive) {
			archiveMutation.mutate({ id: lesson.id });
		}
	};

	const handleDelete = () => {
		if (
			lesson.canDelete &&
			confirm("Are you sure you want to delete this lesson?")
		) {
			deleteMutation.mutate({
				id: lesson.id,
				handleActiveDiscussions: "complete", // Default to letting discussions complete
			});
		}
	};

	return (
		<div className="flex items-center gap-1">
			{lesson.canEdit && (
				<Button
					variant="ghost"
					size="icon"
					onClick={() => onEdit?.(lesson.id)}
					title="Edit lesson"
				>
					<Edit2 className="h-4 w-4" />
				</Button>
			)}

			{lesson.canPublish && (
				<Button
					variant="ghost"
					size="icon"
					onClick={handlePublish}
					disabled={publishMutation.isPending}
					title="Publish lesson"
				>
					<CheckCircle2 className="h-4 w-4" />
				</Button>
			)}

			{lesson.canArchive && (
				<Button
					variant="ghost"
					size="icon"
					onClick={handleArchive}
					disabled={archiveMutation.isPending}
					title="Archive lesson"
				>
					<Archive className="h-4 w-4" />
				</Button>
			)}

			{lesson.canDelete && (
				<Button
					variant="ghost"
					size="icon"
					onClick={handleDelete}
					disabled={deleteMutation.isPending}
					title="Delete lesson"
					className="hover:text-destructive"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
}
