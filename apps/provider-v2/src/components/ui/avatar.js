import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const avatarVariants = cva('relative flex shrink-0 overflow-hidden rounded-sm bg-secondary font-mono uppercase tracking-wider text-muted-foreground', {
    variants: {
        size: {
            xs: 'h-6 w-6 text-[10px]',
            sm: 'h-8 w-8 text-[11px]',
            md: 'h-10 w-10 text-xs',
            lg: 'h-14 w-14 text-sm',
            xl: 'h-20 w-20 text-base',
        },
    },
    defaultVariants: { size: 'md' },
});
export const Avatar = React.forwardRef(({ className, size, ...props }, ref) => (_jsx(AvatarPrimitive.Root, { ref: ref, className: cn(avatarVariants({ size }), className), ...props })));
Avatar.displayName = AvatarPrimitive.Root.displayName;
export const AvatarImage = React.forwardRef(({ className, ...props }, ref) => (_jsx(AvatarPrimitive.Image, { ref: ref, className: cn('aspect-square h-full w-full object-cover', className), ...props })));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;
export const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (_jsx(AvatarPrimitive.Fallback, { ref: ref, className: cn('flex h-full w-full items-center justify-center', className), ...props })));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;
export function initials(first, last) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '·';
}
