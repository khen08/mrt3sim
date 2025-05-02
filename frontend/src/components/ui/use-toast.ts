// Adapted from shadcn/ui: https://ui.shadcn.com/
import React from "react";
import { toast as rtToast, ToastContainer, ToastOptions } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export type ToastProps = {
  title: string;
  description: string;
  variant?: "default" | "destructive";
  duration?: number;
};

export type ToastActionElement = React.ReactElement;

/**
 * Show a toast message using react-toastify, preserving the old API.
 */
export const toast = ({
  title,
  description,
  variant = "default",
  duration = 5000,
}: ToastProps) => {
  // Combine title and description into a single message string
  const message = `${title}: ${description}`;
  const options: ToastOptions = { autoClose: duration };
  if (variant === "destructive") {
    rtToast.error(message, options);
  } else {
    rtToast.info(message, options);
  }
};

/**
 * Hook to access toast and dismiss functions.
 */
export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => {
      rtToast.dismiss(toastId);
    },
  };
}

/**
 * Include this component once (e.g. in layout) to render toast containers.
 */
export const AppToastContainer = ToastContainer;
