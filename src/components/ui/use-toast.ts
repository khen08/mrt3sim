// Adapted from shadcn/ui: https://ui.shadcn.com/
import { useState, useEffect } from "react";

type ToastProps = {
  title: string;
  description: string;
  variant?: "default" | "destructive";
  duration?: number;
};

export type ToastActionElement = React.ReactElement;

export const toast = ({
  title,
  description,
  variant = "default",
  duration = 5000,
}: ToastProps) => {
  // This is a simplified toast implementation
  // In a production app, you would use a proper toast library

  // Create a toast element
  const toastId = Date.now().toString();
  const toastEl = document.createElement("div");
  toastEl.id = `toast-${toastId}`;
  toastEl.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
    variant === "destructive"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800"
  } z-50 transition-all duration-300 ease-in-out transform translate-x-full`;

  // Create title
  const titleEl = document.createElement("div");
  titleEl.className = "font-bold";
  titleEl.textContent = title;
  toastEl.appendChild(titleEl);

  // Create description
  const descEl = document.createElement("div");
  descEl.className = "text-sm";
  descEl.textContent = description;
  toastEl.appendChild(descEl);

  // Append to body
  document.body.appendChild(toastEl);

  // Animate in
  setTimeout(() => {
    toastEl.classList.remove("translate-x-full");
  }, 10);

  // Remove after duration
  setTimeout(() => {
    toastEl.classList.add("translate-x-full");
    setTimeout(() => {
      document.body.removeChild(toastEl);
    }, 300);
  }, duration);

  return {
    id: toastId,
    dismiss: () => {
      toastEl.classList.add("translate-x-full");
      setTimeout(() => {
        if (document.body.contains(toastEl)) {
          document.body.removeChild(toastEl);
        }
      }, 300);
    },
  };
};

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => {
      if (toastId) {
        const toastEl = document.getElementById(`toast-${toastId}`);
        if (toastEl) {
          toastEl.classList.add("translate-x-full");
          setTimeout(() => {
            if (document.body.contains(toastEl)) {
              document.body.removeChild(toastEl);
            }
          }, 300);
        }
      } else {
        // Dismiss all toasts
        const toasts = document.querySelectorAll('[id^="toast-"]');
        toasts.forEach((toast) => {
          toast.classList.add("translate-x-full");
          setTimeout(() => {
            if (document.body.contains(toast)) {
              document.body.removeChild(toast);
            }
          }, 300);
        });
      }
    },
  };
}
