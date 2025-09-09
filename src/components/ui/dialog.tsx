"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import * as React from "react";

interface DialogContextValue {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(
	undefined,
);

const Dialog: React.FC<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
}> = ({ open, onOpenChange, children }) => {
	return (
		<DialogContext.Provider value={{ open, onOpenChange }}>
			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div
						className="fixed inset-0 bg-black/50"
						onClick={() => onOpenChange(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								onOpenChange(false);
							}
						}}
						tabIndex={-1}
						role="button"
						aria-label="Close dialog"
					/>
					{children}
				</div>
			)}
		</DialogContext.Provider>
	);
};

const DialogTrigger = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		asChild?: boolean;
	}
>(({ className, children, asChild = false, ...props }, ref) => {
	const context = React.useContext(DialogContext);
	if (!context) {
		throw new Error("DialogTrigger must be used within a Dialog");
	}

	const { onOpenChange } = context;

	if (asChild) {
		return React.cloneElement(
			children as React.ReactElement<{ onClick?: () => void }>,
			{
				onClick: () => onOpenChange(true),
			},
		);
	}

	return (
		<button
			ref={ref}
			className={cn(className)}
			onClick={() => onOpenChange(true)}
			{...props}
		>
			{children}
		</button>
	);
});
DialogTrigger.displayName = "DialogTrigger";

const DialogContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
	const context = React.useContext(DialogContext);
	if (!context) {
		throw new Error("DialogContent must be used within a Dialog");
	}

	const { onOpenChange } = context;

	return (
		<div
			ref={ref}
			className={cn(
				"relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
				className,
			)}
			{...props}
		>
			{children}
			<button
				type="button"
				className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
				onClick={() => onOpenChange(false)}
			>
				<X className="h-4 w-4" />
				<span className="sr-only">Close</span>
			</button>
		</div>
	);
});
DialogContent.displayName = "DialogContent";

const DialogHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"flex flex-col space-y-1.5 text-center sm:text-left",
			className,
		)}
		{...props}
	/>
));
DialogHeader.displayName = "DialogHeader";

const DialogFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
			className,
		)}
		{...props}
	/>
));
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h3
		ref={ref}
		className={cn(
			"font-semibold text-lg leading-none tracking-tight",
			className,
		)}
		{...props}
	/>
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn("text-muted-foreground text-sm", className)}
		{...props}
	/>
));
DialogDescription.displayName = "DialogDescription";

export {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
};
