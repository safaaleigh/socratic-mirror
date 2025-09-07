"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { CreateLessonForm } from "./_components/create-lesson-form";
import { EditLessonForm } from "./_components/edit-lesson-form";
import { LessonList } from "./_components/lesson-list";

type ViewMode = "list" | "create" | "edit";

export default function LessonsPage() {
	const { data: session, status } = useSession();
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

	if (status === "loading") {
		return (
			<DashboardLayout>
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-1/2 rounded bg-gray-300 dark:bg-gray-600"></div>
					<div className="h-4 w-3/4 rounded bg-gray-300 dark:bg-gray-600"></div>
					<div className="h-64 rounded bg-gray-300 dark:bg-gray-600"></div>
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

	const handleEditSuccess = () => {
		setViewMode("list");
		setEditingLessonId(null);
	};

	const handleEditCancel = () => {
		setViewMode("list");
		setEditingLessonId(null);
	};

	const handleEditLesson = (lessonId: string) => {
		setEditingLessonId(lessonId);
		setViewMode("edit");
	};

	const breadcrumbItems = [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Lessons", isCurrentPage: true },
	];

	return (
		<DashboardLayout breadcrumbItems={breadcrumbItems}>
			<div className="mb-8">
				<h1 className="font-bold text-3xl text-gray-900 dark:text-gray-100">
					Lesson Management
				</h1>
				<p className="mt-2 text-gray-600 dark:text-gray-400">
					Create, organize, and manage lessons that guide AI-facilitated
					Socratic discussions.
				</p>
			</div>

			<div className="grid gap-6">
				{viewMode === "list" && (
					<>
						{/* Header with Create Button */}
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 className="font-semibold text-gray-900 text-xl dark:text-gray-100">
									Your Lessons
								</h2>
								<p className="text-gray-600 text-sm dark:text-gray-400">
									Manage your lesson content and track their status
								</p>
							</div>

							<button
								onClick={() => setViewMode("create")}
								className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
							>
								<svg
									className="mr-2 h-4 w-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 6v6m0 0v6m0-6h6m-6 0H6"
									/>
								</svg>
								Create New Lesson
							</button>
						</div>

						{/* Lesson List */}
						<LessonList onEditLesson={handleEditLesson} />

						{/* Status Legend */}
						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
							<h3 className="mb-3 font-medium text-gray-900 text-sm dark:text-gray-100">
								Lesson Status Guide
							</h3>
							<div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
								<div className="flex items-center gap-2">
									<div className="h-2 w-2 rounded-full bg-yellow-500"></div>
									<span className="text-gray-600 dark:text-gray-400">
										<strong className="text-yellow-600 dark:text-yellow-400">
											Draft:
										</strong>{" "}
										Can be edited and published
									</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="h-2 w-2 rounded-full bg-green-500"></div>
									<span className="text-gray-600 dark:text-gray-400">
										<strong className="text-green-600 dark:text-green-400">
											Published:
										</strong>{" "}
										Available for discussions
									</span>
								</div>
								<div className="flex items-center gap-2">
									<div className="h-2 w-2 rounded-full bg-gray-400"></div>
									<span className="text-gray-600 dark:text-gray-400">
										<strong className="text-gray-600 dark:text-gray-400">
											Archived:
										</strong>{" "}
										Read-only, can be forked
									</span>
								</div>
							</div>
						</div>
					</>
				)}

				{viewMode === "create" && (
					<CreateLessonForm
						onSuccess={handleCreateSuccess}
						onCancel={handleCreateCancel}
					/>
				)}

				{viewMode === "edit" && editingLessonId && (
					<EditLessonForm
						lessonId={editingLessonId}
						onSuccess={handleEditSuccess}
						onCancel={handleEditCancel}
					/>
				)}
			</div>
		</DashboardLayout>
	);
}
