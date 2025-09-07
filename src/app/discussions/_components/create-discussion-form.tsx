"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useState } from "react";

interface CreateDiscussionFormData {
	title: string;
	description: string;
	lessonId: string;
	maxParticipants?: number;
}

export function CreateDiscussionForm({
	onSuccess,
	onCancel,
}: { onSuccess?: () => void; onCancel?: () => void }) {
	const [formData, setFormData] = useState<CreateDiscussionFormData>({
		title: "",
		description: "",
		lessonId: "",
		maxParticipants: undefined,
	});

	const [error, setError] = useState<string | null>(null);

	// Fetch published lessons for selection
	const { data: lessons, isLoading: lessonsLoading } =
		api.lesson.list.useQuery();

	// Filter only published lessons
	const publishedLessons =
		lessons?.filter((lesson) => lesson.status === "published") || [];

	const createMutation = api.discussion.create.useMutation({
		onSuccess: () => {
			setError(null);
			onSuccess?.();
		},
		onError: (error) => {
			setError(error.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!formData.title.trim()) {
			setError("Title is required");
			return;
		}

		if (!formData.lessonId) {
			setError("Please select a lesson");
			return;
		}

		createMutation.mutate({
			name: formData.title.trim(),
			description: formData.description.trim() || undefined,
			lessonId: formData.lessonId,
			maxParticipants: formData.maxParticipants || undefined,
		});
	};

	const handleLessonSelect = (lessonId: string) => {
		setFormData((prev) => ({ ...prev, lessonId }));

		// Auto-fill title and description from selected lesson
		const selectedLesson = publishedLessons.find((l) => l.id === lessonId);
		if (selectedLesson && !formData.title) {
			setFormData((prev) => ({
				...prev,
				title: `Discussion: ${selectedLesson.title}`,
				description: selectedLesson.description || "",
			}));
		}
	};

	return (
		<Card className="w-full max-w-2xl">
			<CardHeader>
				<div className="flex items-center gap-3">
					{onCancel && (
						<Button variant="ghost" size="icon" onClick={onCancel}>
							<ArrowLeft className="h-4 w-4" />
						</Button>
					)}
					<div>
						<CardTitle>Create New Discussion</CardTitle>
						<CardDescription>
							Start a new AI-facilitated discussion based on a published lesson
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{error && (
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Lesson Selection */}
					<div className="space-y-2">
						<Label htmlFor="lesson-select">Select Lesson *</Label>
						{lessonsLoading ? (
							<Skeleton className="h-10 w-full" />
						) : publishedLessons.length === 0 ? (
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									No published lessons available. You need at least one
									published lesson to create a discussion.
								</AlertDescription>
							</Alert>
						) : (
							<Select
								value={formData.lessonId}
								onValueChange={handleLessonSelect}
							>
								<SelectTrigger>
									<SelectValue placeholder="Choose a lesson for this discussion" />
								</SelectTrigger>
								<SelectContent>
									{publishedLessons.map((lesson) => (
										<SelectItem key={lesson.id} value={lesson.id}>
											<div className="flex flex-col">
												<span className="font-medium">{lesson.title}</span>
												{lesson.description && (
													<span className="text-muted-foreground text-xs">
														{lesson.description.slice(0, 60)}
														{lesson.description.length > 60 ? "..." : ""}
													</span>
												)}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>

					{/* Title */}
					<div className="space-y-2">
						<Label htmlFor="title">Discussion Title *</Label>
						<Input
							id="title"
							value={formData.title}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, title: e.target.value }))
							}
							placeholder="Enter a title for this discussion"
							maxLength={200}
						/>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									description: e.target.value,
								}))
							}
							placeholder="Optional description for participants"
							rows={3}
							maxLength={500}
						/>
					</div>

					{/* Max Participants */}
					<div className="space-y-2">
						<Label htmlFor="max-participants">Maximum Participants</Label>
						<Input
							id="max-participants"
							type="number"
							value={formData.maxParticipants || ""}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									maxParticipants: e.target.value
										? Number(e.target.value)
										: undefined,
								}))
							}
							placeholder="Leave empty for unlimited"
							min={2}
							max={100}
						/>
						<p className="text-muted-foreground text-xs">
							Recommended: 4-8 participants for optimal discussion
						</p>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3 pt-4">
						<Button
							type="submit"
							disabled={
								createMutation.isPending || publishedLessons.length === 0
							}
						>
							{createMutation.isPending ? "Creating..." : "Create Discussion"}
						</Button>
						{onCancel && (
							<Button type="button" variant="outline" onClick={onCancel}>
								Cancel
							</Button>
						)}
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
