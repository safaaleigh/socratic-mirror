import { DashboardLayout } from "@/components/dashboard-layout";

export default function DashboardPage() {
	const breadcrumbItems = [
		{ label: "Learning Paths", href: "#" },
		{ label: "Philosophy", isCurrentPage: true },
	];

	return (
		<DashboardLayout breadcrumbItems={breadcrumbItems}>
			<div className="grid auto-rows-min gap-4 md:grid-cols-3">
				<div className="flex aspect-video items-center justify-center rounded-xl bg-muted/50">
					<span className="text-muted-foreground">Recent Discussions</span>
				</div>
				<div className="flex aspect-video items-center justify-center rounded-xl bg-muted/50">
					<span className="text-muted-foreground">Learning Progress</span>
				</div>
				<div className="flex aspect-video items-center justify-center rounded-xl bg-muted/50">
					<span className="text-muted-foreground">Achievements</span>
				</div>
			</div>
			<div className="flex min-h-[100vh] flex-1 items-center justify-center rounded-xl bg-muted/50 md:min-h-min">
				<div className="text-center">
					<h2 className="mb-2 font-bold text-2xl">Welcome to Socratic</h2>
					<p className="text-muted-foreground">
						Your inquiry-based learning journey starts here
					</p>
				</div>
			</div>
		</DashboardLayout>
	);
}
