"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

const Avatar = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
			className,
		)}
		{...props}
	/>
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
	HTMLImageElement,
	React.ImgHTMLAttributes<HTMLImageElement> & { alt: string }
>(({ className, alt, ...props }, ref) => (
	// biome-ignore lint/a11y/useAltText: alt is explicitly required in props and passed to img
	<img
		ref={ref}
		className={cn("aspect-square h-full w-full", className)}
		alt={alt}
		{...props}
	/>
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"flex h-full w-full items-center justify-center rounded-full bg-muted",
			className,
		)}
		{...props}
	/>
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
