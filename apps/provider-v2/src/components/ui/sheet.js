import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Overlay, { ref: ref, className: cn('fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className), ...props })));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;
const sheetVariants = cva('fixed z-50 gap-4 bg-card shadow-navy-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300', {
    variants: {
        side: {
            top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
            bottom: 'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-md data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
            right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-md data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        },
    },
    defaultVariants: { side: 'right' },
});
export const SheetContent = React.forwardRef(({ side = 'right', className, children, ...props }, ref) => (_jsxs(SheetPortal, { children: [_jsx(SheetOverlay, {}), _jsxs(DialogPrimitive.Content, { ref: ref, className: cn(sheetVariants({ side }), className), ...props, children: [children, _jsxs(DialogPrimitive.Close, { className: "absolute right-4 top-4 rounded-sm p-1 text-muted-foreground opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring", children: [_jsx(X, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: "Close" })] })] })] })));
SheetContent.displayName = DialogPrimitive.Content.displayName;
export const SheetHeader = ({ className, ...props }) => (_jsx("div", { className: cn('flex flex-col gap-1.5 border-b border-border/70 p-6', className), ...props }));
export const SheetFooter = ({ className, ...props }) => (_jsx("div", { className: cn('flex flex-col-reverse gap-2 border-t border-border/70 p-6 sm:flex-row sm:justify-end', className), ...props }));
export const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Title, { ref: ref, className: cn('font-serif text-2xl tracking-tightest', className), ...props })));
SheetTitle.displayName = DialogPrimitive.Title.displayName;
export const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx(DialogPrimitive.Description, { ref: ref, className: cn('text-sm text-muted-foreground', className), ...props })));
SheetDescription.displayName = DialogPrimitive.Description.displayName;
