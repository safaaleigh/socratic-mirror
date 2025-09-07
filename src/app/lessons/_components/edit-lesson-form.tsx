"use client";

import { api } from "@/trpc/react";
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

	const removeObjective = (index: number) => {
		setFormData((prev) => ({
			...prev,
			objectives: prev.objectives.filter((_, i) => i !== index),
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

	const removeQuestion = (index: number) => {
		setFormData((prev) => ({
			...prev,
			keyQuestions: prev.keyQuestions.filter((_, i) => i !== index),
		}));
	};

	if (isLoading) {
		return (
			<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-1/2 rounded bg-gray-300 dark:bg-gray-600"></div>
					<div className="h-4 w-3/4 rounded bg-gray-300 dark:bg-gray-600"></div>
					<div className="h-32 rounded bg-gray-300 dark:bg-gray-600"></div>
				</div>
			</div>
		);
	}

	if (!lesson) {
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
						Lesson not found
					</h3>
					<p className="mt-1 text-red-600 text-sm dark:text-red-400">
						The lesson you're trying to edit could not be found.
					</p>
				</div>
			</div>
		);
	}

	if (!lesson.canEdit) {
		return (
			<div className="rounded-lg border border-yellow-200 bg-white p-6 shadow-sm dark:border-yellow-800 dark:bg-gray-800">
				<div className="text-center">
					<div className="text-yellow-600 dark:text-yellow-400">
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
								d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
					</div>
					<h3 className="mt-2 font-medium text-sm text-yellow-900 dark:text-yellow-100">
						Cannot edit lesson
					</h3>
					<p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
						This lesson cannot be edited. Only draft lessons can be modified.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div className="mb-6">
				<h2 className="font-semibold text-gray-900 text-xl dark:text-gray-100">
					Edit Lesson
				</h2>
				<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
					Modify your lesson content and settings.
				</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-6">
				<div>
					<label
						htmlFor="title"
						className="block font-medium text-gray-700 text-sm dark:text-gray-300"
					>
						Title *
					</label>
					<input
						type="text"
						id="title"
						required
						maxLength={200}
						value={formData.title}
						onChange={(e) =>
							setFormData((prev) => ({ ...prev, title: e.target.value }))
						}
						className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						placeholder="Enter lesson title"
					/>
					<p className="mt-1 text-gray-500 text-xs dark:text-gray-400">
						{formData.title.length}/200 characters
					</p>
				</div>

				<div>
					<label
						htmlFor="description"
						className="block font-medium text-gray-700 text-sm dark:text-gray-300"
					>
						Description *
					</label>
					<textarea
						id="description"
						required
						rows={3}
						value={formData.description}
						onChange={(e) =>
							setFormData((prev) => ({ ...prev, description: e.target.value }))
						}
						className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						placeholder="Briefly describe what this lesson covers"
					/>
				</div>

				<div>
					<label
						htmlFor="content"
						className="block font-medium text-gray-700 text-sm dark:text-gray-300"
					>
						Content *
					</label>
					<textarea
						id="content"
						required
						rows={6}
						value={formData.content}
						onChange={(e) =>
							setFormData((prev) => ({ ...prev, content: e.target.value }))
						}
						className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						placeholder="Detailed lesson content, instructions, and materials"
					/>
				</div>

				<div>
					<label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
						Learning Objectives
					</label>
					<div className="mt-1 flex gap-2">
						<input
							type="text"
							value={objectiveInput}
							onChange={(e) => setObjectiveInput(e.target.value)}
							onKeyDown={(e) =>
								e.key === "Enter" && (e.preventDefault(), addObjective())
							}
							className="flex-1 rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							placeholder="Add a learning objective"
						/>
						<button
							type="button"
							onClick={addObjective}
							className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
						>
							Add
						</button>
					</div>
					{formData.objectives.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-2">
							{formData.objectives.map((objective, index) => (
								<span
									key={index}
									className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-blue-800 text-sm dark:bg-blue-900/30 dark:text-blue-300"
								>
									{objective}
									<button
										type="button"
										onClick={() => removeObjective(index)}
										className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
									>
										×
									</button>
								</span>
							))}
						</div>
					)}
				</div>

				<div>
					<label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
						Key Questions
					</label>
					<div className="mt-1 flex gap-2">
						<input
							type="text"
							value={questionInput}
							onChange={(e) => setQuestionInput(e.target.value)}
							onKeyDown={(e) =>
								e.key === "Enter" && (e.preventDefault(), addQuestion())
							}
							className="flex-1 rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							placeholder="Add a key question for discussion"
						/>
						<button
							type="button"
							onClick={addQuestion}
							className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
						>
							Add
						</button>
					</div>
					{formData.keyQuestions.length > 0 && (
						<div className="mt-2 space-y-1">
							{formData.keyQuestions.map((question, index) => (
								<div
									key={index}
									className="flex items-start justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-700"
								>
									<span className="text-gray-700 text-sm dark:text-gray-300">
										{question}
									</span>
									<button
										type="button"
										onClick={() => removeQuestion(index)}
										className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
									>
										×
									</button>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div>
						<label
							htmlFor="facilitationStyle"
							className="block font-medium text-gray-700 text-sm dark:text-gray-300"
						>
							Facilitation Style
						</label>
						<select
							id="facilitationStyle"
							value={formData.facilitationStyle}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									facilitationStyle: e.target.value as FacilitationStyle,
								}))
							}
							className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						>
							<option value="exploratory">Exploratory</option>
							<option value="analytical">Analytical</option>
							<option value="ethical">Ethical</option>
						</select>
					</div>

					<div>
						<label
							htmlFor="suggestedDuration"
							className="block font-medium text-gray-700 text-sm dark:text-gray-300"
						>
							Duration (minutes)
						</label>
						<input
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
							className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							placeholder="Optional"
						/>
					</div>

					<div>
						<label
							htmlFor="suggestedGroupSize"
							className="block font-medium text-gray-700 text-sm dark:text-gray-300"
						>
							Group Size
						</label>
						<input
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
							className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>
				</div>

				{updateMutation.error && (
					<div className="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
						<div className="text-red-700 text-sm dark:text-red-400">
							Error updating lesson: {updateMutation.error.message}
						</div>
					</div>
				)}

				<div className="flex items-center justify-end space-x-3 border-gray-200 border-t pt-4 dark:border-gray-600">
					{onCancel && (
						<button
							type="button"
							onClick={onCancel}
							className="rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:focus:ring-offset-gray-800 dark:hover:bg-gray-600"
						>
							Cancel
						</button>
					)}
					<button
						type="submit"
						disabled={updateMutation.isPending}
						className="rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-800"
					>
						{updateMutation.isPending ? "Saving..." : "Save Changes"}
					</button>
				</div>
			</form>
		</div>
	);
}
