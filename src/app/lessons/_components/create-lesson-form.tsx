"use client";

import { api } from "@/trpc/react";
import { useState } from "react";

type FacilitationStyle = "exploratory" | "analytical" | "ethical";

interface CreateLessonFormData {
	title: string;
	description: string;
	content: string;
	objectives: string[];
	keyQuestions: string[];
	facilitationStyle: FacilitationStyle;
	suggestedDuration?: number;
	suggestedGroupSize: number;
}

export function CreateLessonForm({
	onSuccess,
	onCancel,
}: { onSuccess?: () => void; onCancel?: () => void }) {
	const [formData, setFormData] = useState<CreateLessonFormData>({
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

	const createMutation = api.lesson.create.useMutation({
		onSuccess: () => {
			void utils.lesson.list.invalidate();
			onSuccess?.();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		createMutation.mutate({
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

	return (
		<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div className="mb-6">
				<h2 className="font-semibold text-gray-900 text-xl dark:text-gray-100">
					Create New Lesson
				</h2>
				<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
					Design a lesson to guide AI-facilitated discussions.
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

				{createMutation.error && (
					<div className="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
						<div className="text-red-700 text-sm dark:text-red-400">
							Error creating lesson: {createMutation.error.message}
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
						disabled={createMutation.isPending}
						className="rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-800"
					>
						{createMutation.isPending ? "Creating..." : "Create Lesson"}
					</button>
				</div>
			</form>
		</div>
	);
}
