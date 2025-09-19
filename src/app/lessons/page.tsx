"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
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

	const breadcrumbItems = [{ label: "Lessons", isCurrentPage: true }];

	return (
		<DashboardLayout breadcrumbItems={breadcrumbItems}>
			<div className="mb-8">
				<h1 className="font-bold text-3xl">Lesson Management</h1>
				<p className="mt-2 text-muted-foreground">
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
								<h2 className="font-semibold text-xl">Your Lessons</h2>
								<p className="text-muted-foreground text-sm">
									Manage your lesson content and track their status
								</p>
							</div>

							<Button onClick={() => setViewMode("create")}>
								<Plus className="mr-2 h-4 w-4" />
								Create New Lesson
							</Button>
						</div>

						{/* Lesson List */}
						<LessonList onEditLesson={handleEditLesson} />

						{/* Status Legend */}
						<div className="rounded-lg bg-muted/50 p-4">
							<h3 className="mb-3 font-medium text-sm">Lesson Status Guide</h3>
							<div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="gap-1 text-xs">
										Draft
									</Badge>
									<span className="text-muted-foreground">
										Can be edited and published
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="default" className="gap-1 text-xs">
										Published
									</Badge>
									<span className="text-muted-foreground">
										Available for discussions
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="secondary" className="gap-1 text-xs">
										Archived
									</Badge>
									<span className="text-muted-foreground">
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
