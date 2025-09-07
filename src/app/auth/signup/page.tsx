"use client";

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
import { api } from "@/trpc/react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUp() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const registerMutation = api.auth.register.useMutation({
		onSuccess: async () => {
			// After successful registration, automatically sign in the user
			const result = await signIn("credentials", {
				email,
				password,
				redirect: false,
			});

			if (result?.error) {
				setError(
					"Account created but sign-in failed. Please sign in manually.",
				);
			} else {
				router.push("/");
				router.refresh();
			}
		},
		onError: (error) => {
			setError(error.message);
			setLoading(false);
		},
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		// Client-side validation
		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setLoading(false);
			return;
		}

		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			setLoading(false);
			return;
		}

		// Call the registration mutation
		registerMutation.mutate({
			name,
			email,
			password,
		});
	};

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader>
						<CardTitle>Create an account</CardTitle>
						<CardDescription>
							Enter your details to create a new account
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit}>
							<div className="flex flex-col gap-6">
								{error && (
									<div className="rounded-md bg-red-50 p-4 text-red-700 text-sm">
										{error}
									</div>
								)}
								<div className="grid gap-3">
									<Label htmlFor="name">Name</Label>
									<Input
										id="name"
										type="text"
										placeholder="Your name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										required
									/>
								</div>
								<div className="grid gap-3">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										placeholder="m@example.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
									/>
								</div>
								<div className="grid gap-3">
									<Label htmlFor="password">Password</Label>
									<Input
										id="password"
										type="password"
										placeholder="At least 6 characters"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
									/>
								</div>
								<div className="grid gap-3">
									<Label htmlFor="confirmPassword">Confirm Password</Label>
									<Input
										id="confirmPassword"
										type="password"
										placeholder="Confirm your password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										required
									/>
								</div>
								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? "Creating account..." : "Create account"}
								</Button>
							</div>
							<div className="mt-4 text-center text-sm">
								Already have an account?{" "}
								<Link
									href="/auth/signin"
									className="underline underline-offset-4"
								>
									Sign in
								</Link>
							</div>
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
