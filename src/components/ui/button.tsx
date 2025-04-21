import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Custom color palette for MRT theme
const MRT_COLORS = {
  blue: "#0D3A96",
  green: "#018110",
  yellow: "#F6D251",
  red: "#D81616",
};

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-[#0D3A96] text-white shadow-sm hover:shadow-md hover:brightness-110 transition-all duration-200",
        destructive:
          "bg-[#D81616] text-white shadow-sm hover:shadow-md hover:brightness-110 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 transition-all duration-200",
        outline:
          "border border-input bg-background shadow-sm hover:shadow-md hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/30 dark:bg-input/30 dark:border-input dark:hover:bg-input/50 transition-all duration-200",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:shadow-md hover:bg-secondary/80 transition-all duration-200",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-all duration-200",
        link: "text-primary underline-offset-4 hover:underline transition-all duration-200",
        success:
          "bg-[#018110] text-white shadow-sm hover:shadow-md hover:brightness-110 transition-all duration-200",
        cta: "bg-[#F6D251] text-gray-900 font-semibold shadow-sm hover:shadow-md hover:brightness-105 transition-all duration-200",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3 font-medium",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4 font-medium",
        icon: "size-10 shadow-sm hover:shadow-md transition-all duration-200",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants, MRT_COLORS };
