import React from "react";
import { toast as toastify, ToastOptions, Id } from "react-toastify";

type ToastProps = {
  title: string;
  description: string;
  variant?: "default" | "destructive" | "success" | "info" | "warning";
  duration?: number;
};

export function toast({
  title,
  description,
  variant = "default",
  duration = 5000,
}: ToastProps): { id: Id; dismiss: () => void } {
  // Map our variants to toastify's types
  const type =
    variant === "destructive"
      ? "error"
      : variant === "success"
      ? "success"
      : variant === "warning"
      ? "warning"
      : variant === "info"
      ? "info"
      : "default";

  const options: ToastOptions = {
    autoClose: duration,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  };

  // Create content with title and description
  const content = (
    <div>
      <div className="font-medium">{title}</div>
      {description && <div className="text-sm mt-1">{description}</div>}
    </div>
  );

  // Use the appropriate toast type
  let id;
  if (type === "error") {
    id = toastify.error(content, options);
  } else if (type === "success") {
    id = toastify.success(content, options);
  } else if (type === "warning") {
    id = toastify.warning(content, options);
  } else if (type === "info") {
    id = toastify.info(content, options);
  } else {
    id = toastify(content, options);
  }

  return {
    id,
    dismiss: () => toastify.dismiss(id),
  };
}

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: Id) => {
      if (toastId) {
        toastify.dismiss(toastId);
      } else {
        toastify.dismiss();
      }
    },
  };
}
