import { create } from "zustand";
import { toast } from "@/components/ui/use-toast";
import { UPLOAD_CSV_ENDPOINT } from "@/lib/constants";

interface UploadStatus {
  success: boolean;
  message: string;
}

interface FileState {
  // File state
  uploadedFileObject: File | null;
  uploadStatus: UploadStatus | null;

  // Actions
  uploadFile: (
    selectedFile: File
  ) => Promise<{ success: boolean; filename: string | null; error?: string }>;
  setUploadedFileObject: (file: File | null) => void;
  setUploadStatus: (status: UploadStatus | null) => void;
}

export const useFileStore = create<FileState>((set) => ({
  uploadedFileObject: null,
  uploadStatus: null,

  // Set the uploaded file object
  setUploadedFileObject: (file) => set({ uploadedFileObject: file }),

  // Set upload status
  setUploadStatus: (status) => set({ uploadStatus: status }),

  // Upload a file to the server
  uploadFile: async (selectedFile) => {
    set({ uploadedFileObject: selectedFile });

    const formData = new FormData();
    formData.append("passenger_data_file", selectedFile);

    try {
      toast({
        title: "Uploading File",
        description: `Uploading '${selectedFile.name}'. Please wait.`,
      });

      const response = await fetch(UPLOAD_CSV_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Upload Successful",
        description: `File '${result.filename}' uploaded successfully.`,
        variant: "default",
      });

      return { success: true, filename: result.filename };
    } catch (error: any) {
      console.error("Error uploading file:", error);

      set({ uploadedFileObject: null });

      toast({
        title: "Upload Failed",
        description:
          error.message || "Could not upload the file. Please try again.",
        variant: "destructive",
      });

      return { success: false, filename: null, error: error.message };
    }
  },
}));
