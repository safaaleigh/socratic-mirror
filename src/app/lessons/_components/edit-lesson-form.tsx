"use client";

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
import { AlertCircle, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";

type FacilitationStyle = "exploratory" | "analytical" | "ethical";

interface EditLessonFormData {
	title: string;
	description: string;
	content: string;
	objectives: string[];
	keyQuestions: string[];
	facilitationStyle: FacilitationStyle;
	suggestedDuration?: number;
	suggestedGroupSize: number;
}

export function EditLessonForm({
	lessonId,
	onSuccess,
	onCancel,
}: {
	lessonId: string;
	onSuccess?: () => void;
	onCancel?: () => void;
}) {
	const [formData, setFormData] = useState<EditLessonFormData>({
		title: "",
		description: "",
		content: "",
		objectives: [],
		keyQuestions: [],
		facilitationStyle: "exploratory",
		suggestedGroupSize: 3,
	});

	const [objectiveInput, setObjectiveInput] = useState("");
	const [questionInput, setQuestionInput] = useState("");

	const utils = api.useUtils();

	const { data: lesson, isLoading } = api.lesson.getById.useQuery({
		id: lessonId,
	});

	const updateMutation = api.lesson.update.useMutation({
		onSuccess: () => {
			void utils.lesson.list.invalidate();
			void utils.lesson.getById.invalidate({ id: lessonId });
			onSuccess?.();
		},
	});

	useEffect(() => {
		if (lesson) {
			setFormData({
				title: lesson.title,
				description: lesson.description,
				content: lesson.content,
				objectives: lesson.objectives,
				keyQuestions: lesson.keyQuestions,
				facilitationStyle: lesson.facilitationStyle,
				suggestedDuration: lesson.suggestedDuration || undefined,
				suggestedGroupSize: lesson.suggestedGroupSize,
			});
		}
	}, [lesson]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		updateMutation.mutate({
			id: lessonId,
			...formData,
			suggestedDuration: formData.suggestedDuration || undefined,
		});
	};

	const addObjective = () => {
		if (objectiveInput.trim()) {
			setFormData((prev) => ({
				...prev,
				objectives: [...prev.objectives, objectiveInput.trim()],
			}));
			setObjectiveInput("");
		}
	};

	const removeObjective = (objectiveToRemove: string) => {
		setFormData((prev) => ({
			...prev,
			objectives: prev.objectives.filter((obj) => obj !== objectiveToRemove),
		}));
	};

	const addQuestion = () => {
		if (questionInput.trim()) {
			setFormData((prev) => ({
				...prev,
				keyQuestions: [...prev.keyQuestions, questionInput.trim()],
			}));
			setQuestionInput("");
		}
	};

	const removeQuestion = (questionToRemove: string) => {
		setFormData((prev) => ({
			...prev,
			keyQuestions: prev.keyQuestions.filter((q) => q !== questionToRemove),
		}));
	};

	if (isLoading) {
		return (
			<Card>
				<CardContent className="p-6">
					<div className="space-y-4">
						<Skeleton className="h-8 w-1/2" />
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-32 w-full" />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!lesson) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Lesson not found</AlertTitle>
				<AlertDescription>
					The lesson you're trying to edit could not be found.
				</AlertDescription>
			</Alert>
		);
	}

	if (!lesson.canEdit) {
		return (
			<Alert>
				<Lock className="h-4 w-4" />
				<AlertTitle>Cannot edit lesson</AlertTitle>
				<AlertDescription>
					This lesson cannot be edited. Only draft lessons can be modified.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Edit Lesson</CardTitle>
				<CardDescription>
					Modify your lesson content and settings.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="title">Title *</Label>
						<Input
							id="title"
							required
							maxLength={200}
							value={formData.title}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, title: e.target.value }))
							}
							placeholder="Enter lesson title"
						/>
						<p className="text-muted-foreground text-xs">
							{formData.title.length}/200 characters
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description *</Label>
						<Textarea
							id="description"
							required
							rows={3}
							value={formData.description}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									description: e.target.value,
								}))
							}
							placeholder="Briefly describe what this lesson covers"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="content">Content *</Label>
						<Textarea
							id="content"
							required
							rows={6}
							value={formData.content}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, content: e.target.value }))
							}
							placeholder="Detailed lesson content, instructions, and materials"
						/>
					</div>

					<div className="space-y-2">
						<Label>Learning Objectives</Label>
						<div className="flex gap-2">
							<Input
								value={objectiveInput}
								onChange={(e) => setObjectiveInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addObjective();
									}
								}}
								placeholder="Add a learning objective"
								className="flex-1"
							/>
							<Button type="button" onClick={addObjective}>
								Add
							</Button>
						</div>
						{formData.objectives.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{formData.objectives.map((objective) => (
									<Badge
										key={`objective-${objective}`}
										variant="secondary"
										className="gap-1"
									>
										{objective}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => removeObjective(objective)}
											className="h-4 w-4 p-0 hover:bg-transparent"
										>
											<X className="h-3 w-3" />
										</Button>
									</Badge>
								))}
							</div>
						)}
					</div>

					<div className="space-y-2">
						<Label>Key Questions</Label>
						<div className="flex gap-2">
							<Input
								value={questionInput}
								onChange={(e) => setQuestionInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addQuestion();
									}
								}}
								placeholder="Add a key question for discussion"
								className="flex-1"
							/>
							<Button type="button" onClick={addQuestion}>
								Add
							</Button>
						</div>
						{formData.keyQuestions.length > 0 && (
							<div className="space-y-2">
								{formData.keyQuestions.map((question) => (
									<div
										key={`question-${question}`}
										className="flex items-start justify-between rounded-md bg-muted px-3 py-2"
									>
										<span className="text-sm">{question}</span>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => removeQuestion(question)}
											className="h-6 w-6 hover:text-destructive"
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="facilitationStyle">Facilitation Style</Label>
							<Select
								value={formData.facilitationStyle}
								onValueChange={(value) =>
									setFormData((prev) => ({
										...prev,
										facilitationStyle: value as FacilitationStyle,
									}))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="exploratory">Exploratory</SelectItem>
									<SelectItem value="analytical">Analytical</SelectItem>
									<SelectItem value="ethical">Ethical</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="suggestedDuration">Duration (minutes)</Label>
							<Input
								type="number"
								id="suggestedDuration"
								min="1"
								max="240"
								value={formData.suggestedDuration || ""}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										suggestedDuration: e.target.value
											? Number.parseInt(e.target.value)
											: undefined,
									}))
								}
								placeholder="Optional"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="suggestedGroupSize">Group Size</Label>
							<Input
								type="number"
								id="suggestedGroupSize"
								min="1"
								max="20"
								value={formData.suggestedGroupSize}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										suggestedGroupSize: Number.parseInt(e.target.value) || 3,
									}))
								}
							/>
						</div>
					</div>

					{updateMutation.error && (
						<Alert variant="destructive">
							<AlertDescription>
								Error updating lesson: {updateMutation.error.message}
							</AlertDescription>
						</Alert>
					)}

					<div className="flex items-center justify-end space-x-3 border-t pt-4">
						{onCancel && (
							<Button type="button" variant="outline" onClick={onCancel}>
								Cancel
							</Button>
						)}
						<Button type="submit" disabled={updateMutation.isPending}>
							{updateMutation.isPending ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
