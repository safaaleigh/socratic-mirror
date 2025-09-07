"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignOut() {
	const [isSigningOut, setIsSigningOut] = useState(true);
	const [isComplete, setIsComplete] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const performSignOut = async () => {
			try {
				await signOut({
					redirect: false,
				});
				setIsComplete(true);

				// Redirect to home page after a brief delay
				setTimeout(() => {
					router.push("/");
					router.refresh();
				}, 2000);
			} catch (error) {
				console.error("Sign out error:", error);
				setIsComplete(true);
			} finally {
				setIsSigningOut(false);
			}
		};

		performSignOut();
	}, [router]);

	if (isSigningOut) {
		return (
			<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
				<div className="w-full max-w-sm">
					<Card>
						<CardHeader>
							<CardTitle>Signing out...</CardTitle>
							<CardDescription>
								Please wait while we sign you out.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-center py-4">
								<div className="h-6 w-6 animate-spin rounded-full border-primary border-b-2"></div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader>
						<CardTitle>Goodbye!</CardTitle>
						<CardDescription>
							You have been successfully signed out. Thank you for using
							Socratic!
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-col gap-4">
							<p className="text-center text-muted-foreground text-sm">
								You will be redirected to the home page shortly...
							</p>
							<Button onClick={() => router.push("/")} className="w-full">
								Go to Home
							</Button>
						</div>
						<div className="mt-4 text-center text-sm">
							<Link
								href="/auth/signin"
								className="underline underline-offset-4"
							>
								Sign in again
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
