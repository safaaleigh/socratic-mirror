import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { auth } from "@/server/auth";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
	const session = await auth();

	return (
		<HydrateClient>
			<div className="min-h-screen bg-background">
				<header className="absolute top-0 right-0 flex items-center gap-2 p-4">
					{session ? (
						<Button asChild size="sm">
							<Link href="/dashboard">Dashboard</Link>
						</Button>
					) : (
						<>
							<Button asChild size="sm">
								<Link href="/auth/signin">Sign In</Link>
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link href="/auth/signup">Sign Up</Link>
							</Button>
						</>
					)}
					<ModeToggle />
				</header>

				<main className="flex min-h-screen flex-col items-center justify-center px-4">
					<div className="mx-auto max-w-6xl text-center">
						<h1 className="mb-6 font-bold text-8xl text-foreground leading-none md:text-[12rem] lg:text-[16rem]">
							socratic
						</h1>
						<p className="mx-auto max-w-2xl text-muted-foreground text-xl md:text-2xl">
							An discussion and inquiry based learning platform
						</p>
					</div>
				</main>
			</div>
		</HydrateClient>
	);
}
