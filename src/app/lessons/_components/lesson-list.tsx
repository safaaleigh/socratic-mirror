"use client";

import { formatDistanceToNow } from "date-fns";

import { api } from "@/trpc/react";

export function LessonList({
	onEditLesson,
}: { onEditLesson?: (lessonId: string) => void }) {
	const { data: lessons, isLoading, error } = api.lesson.list.useQuery();

	if (isLoading) {
		return (
			<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div className="animate-pulse space-y-4">
					{[...Array(3)].map((_, i) => (
						<div
							key={i}
							className="border-gray-200 border-b pb-4 last:border-b-0 dark:border-gray-700"
						>
							<div className="mb-2 h-4 w-3/4 rounded bg-gray-300 dark:bg-gray-600"></div>
							<div className="mb-2 h-3 w-1/2 rounded bg-gray-300 dark:bg-gray-600"></div>
							<div className="h-3 w-1/4 rounded bg-gray-300 dark:bg-gray-600"></div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm dark:border-red-800 dark:bg-gray-800">
				<div className="text-center">
					<div className="text-red-600 dark:text-red-400">
						<svg
							className="mx-auto h-8 w-8"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
					</div>
					<h3 className="mt-2 font-medium text-red-900 text-sm dark:text-red-100">
						Error loading lessons
					</h3>
					<p className="mt-1 text-red-600 text-sm dark:text-red-400">
						{error.message}
					</p>
				</div>
			</div>
		);
	}

	if (!lessons || lessons.length === 0) {
		return (
			<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div className="py-12 text-center">
					<div className="mx-auto h-12 w-12 text-gray-400">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
							/>
						</svg>
					</div>
					<h3 className="mt-4 font-medium text-gray-900 text-lg dark:text-gray-100">
						No lessons yet
					</h3>
					<p className="mx-auto mt-2 max-w-sm text-gray-600 text-sm dark:text-gray-400">
						Get started by creating your first lesson. Lessons guide
						AI-facilitated discussions and can be reused across multiple
						sessions.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div className="divide-y divide-gray-200 dark:divide-gray-700">
				{lessons.map((lesson) => (
					<div
						key={lesson.id}
						data-testid={`lesson-card-${lesson.id}`}
						className="p-6 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
					>
						<div className="flex items-start justify-between">
							<div className="min-w-0 flex-1">
								<div className="mb-2 flex items-center gap-3">
									<h3 className="truncate font-medium text-gray-900 text-lg dark:text-gray-100">
										{lesson.title}
									</h3>
									<LessonStatusBadge status={lesson.status} />
								</div>

								{lesson.description && (
									<p className="mb-3 line-clamp-2 text-gray-600 text-sm dark:text-gray-400">
										{lesson.description}
									</p>
								)}

								<div className="flex flex-wrap items-center gap-4 text-gray-500 text-xs dark:text-gray-400">
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
										<div className="mb-1 text-gray-500 text-xs dark:text-gray-400">
											Objectives ({lesson.objectives.length})
										</div>
										<div className="flex flex-wrap gap-1">
											{lesson.objectives
												.slice(0, 3)
												.map((objective: string, index: number) => (
													<span
														key={index}
														className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
													>
														{objective}
													</span>
												))}
											{lesson.objectives.length > 3 && (
												<span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-gray-600 text-xs dark:bg-gray-700 dark:text-gray-400">
													+{lesson.objectives.length - 3} more
												</span>
											)}
										</div>
									</div>
								)}
							</div>

							<div className="ml-4 flex items-center gap-2">
								<LessonActions lesson={lesson} onEdit={onEditLesson} />
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function LessonStatusBadge({
	status,
}: { status: "draft" | "published" | "archived" }) {
	const statusConfig = {
		draft: {
			color:
				"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
			icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
		},
		published: {
			color:
				"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
			icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
		},
		archived: {
			color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300",
			icon: "M5 8a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8z",
		},
	};

	const config = statusConfig[status];

	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-1 font-medium text-xs ${config.color}`}
		>
			<svg
				className="mr-1 h-3 w-3"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d={config.icon}
				/>
			</svg>
			{status.charAt(0).toUpperCase() + status.slice(1)}
		</span>
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
				<button
					onClick={() => onEdit?.(lesson.id)}
					className="p-2 text-gray-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
					title="Edit lesson"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
						/>
					</svg>
				</button>
			)}

			{lesson.canPublish && (
				<button
					onClick={handlePublish}
					disabled={publishMutation.isPending}
					className="p-2 text-gray-400 transition-colors hover:text-green-600 disabled:opacity-50 dark:hover:text-green-400"
					title="Publish lesson"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</button>
			)}

			{lesson.canArchive && (
				<button
					onClick={handleArchive}
					disabled={archiveMutation.isPending}
					className="p-2 text-gray-400 transition-colors hover:text-orange-600 disabled:opacity-50 dark:hover:text-orange-400"
					title="Archive lesson"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M5 8a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V8z"
						/>
					</svg>
				</button>
			)}

			{lesson.canDelete && (
				<button
					onClick={handleDelete}
					disabled={deleteMutation.isPending}
					className="p-2 text-gray-400 transition-colors hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
					title="Delete lesson"
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</button>
			)}
		</div>
	);
}
