import { create } from "zustand";
import { toast } from "@/components/ui/use-toast";
import { UPLOAD_CSV_ENDPOINT } from "@/lib/constants";

export type UploadSource = "main-upload" | "settings-change" | null;

export type UploadStatus = {
  success: boolean;
  message: string;
  details?: string[];
  errorType?: "format_error" | "server_error" | "network_error";
};

// FileMetadata tracks additional information about the uploaded file
export interface FileMetadata {
  isInherited?: boolean; // Whether file was inherited from loaded simulation
  simulationId?: number; // ID of simulation the file was loaded from
  isRequired?: boolean; // Whether a file is required but not yet selected
}

interface FileState {
  // File state
  uploadedFileObject: File | null;
  uploadedFileName: string | null;
  uploadStatus: UploadStatus | null;
  uploadSource: UploadSource;
  fileMetadata: FileMetadata;

  // Actions
  uploadFile: (
    file: File,
    source?: UploadSource
  ) => Promise<{
    success: boolean;
    filename?: string;
    error?: string;
    details?: string[];
    errorType?: "format_error" | "server_error" | "network_error";
  }>;
  setUploadedFileObject: (file: File | null) => void;
  setUploadStatus: (status: UploadStatus | null) => void;
  resetUploadState: () => void;
  setUploadSource: (source: UploadSource) => void;
  setFileMetadata: (metadata: Partial<FileMetadata>) => void;
  updateFileMetadata: (updates: Partial<FileMetadata>) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  uploadedFileObject: null,
  uploadedFileName: null,
  uploadStatus: null,
  uploadSource: null,
  fileMetadata: {},

  // Set the uploaded file object
  setUploadedFileObject: (file) => set({ uploadedFileObject: file }),

  // Set upload status
  setUploadStatus: (status) => set({ uploadStatus: status }),

  // Set file metadata
  setFileMetadata: (metadata) => set({ fileMetadata: metadata }),

  // Update file metadata without replacing the entire object
  updateFileMetadata: (updates) => {
    const currentMetadata = get().fileMetadata;
    set({ fileMetadata: { ...currentMetadata, ...updates } });
  },

  // Upload a file to the server
  uploadFile: async (file, source = "main-upload") => {
    // Check file extension before sending to server
    if (!file.name.toLowerCase().endsWith(".csv")) {
      const errorStatus = {
        success: false,
        message: "Invalid file format",
        details: ["Only CSV files are allowed"],
        errorType: "format_error",
      } as UploadStatus;

      set({
        uploadStatus: errorStatus,
        uploadSource: source,
      });

      return {
        success: false,
        error: "Invalid file format",
        details: ["Only CSV files are allowed"],
        errorType: "format_error",
      };
    }

    // Client-side size validation
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      const errorStatus = {
        success: false,
        message: "File too large",
        details: ["Maximum file size is 5MB"],
        errorType: "format_error",
      } as UploadStatus;

      set({
        uploadStatus: errorStatus,
        uploadSource: source,
      });

      return {
        success: false,
        error: "File too large",
        details: ["Maximum file size is 5MB"],
        errorType: "format_error",
      };
    }

    set({
      uploadedFileObject: file,
      uploadedFileName: file.name,
      uploadSource: source,
      fileMetadata: {
        ...get().fileMetadata,
        isInherited: false, // New upload is not inherited
        isRequired: false, // No longer required as we're uploading
      },
    });

    const formData = new FormData();
    formData.append("passenger_data_file", file);

    try {
      const response = await fetch(UPLOAD_CSV_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.filename) {
        set({
          uploadStatus: {
            success: true,
            message: "File uploaded successfully",
          },
        });
        return { success: true, filename: data.filename };
      } else {
        // Enhanced error handling
        const errorMessage = data.error || "Unknown error occurred";
        const errorDetails = data.details || [];
        const errorType = data.error?.includes("Invalid file")
          ? "format_error"
          : "server_error";

        // Check for CSV format errors in the error message
        if (
          errorMessage.includes("Invalid CSV") ||
          errorMessage.includes("missing required columns") ||
          errorMessage.includes("Invalid file format") ||
          errorMessage.includes("file structure")
        ) {
          set({
            uploadStatus: {
              success: false,
              message: errorMessage,
              details: errorDetails,
              errorType: "format_error",
            },
          });

          return {
            success: false,
            error: errorMessage,
            details: errorDetails,
            errorType: "format_error",
          };
        }

        set({
          uploadStatus: {
            success: false,
            message: errorMessage,
            details: errorDetails,
            errorType: errorType,
          },
        });

        return {
          success: false,
          error: errorMessage,
          details: errorDetails,
          errorType: errorType,
        };
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      set({
        uploadStatus: {
          success: false,
          message: "Network error occurred",
          errorType: "network_error",
        },
      });
      return {
        success: false,
        error: "Network error occurred",
        errorType: "network_error",
      };
    }
  },

  resetUploadState: () =>
    set({
      uploadedFileObject: null,
      uploadedFileName: null,
      uploadStatus: null,
      uploadSource: null,
      fileMetadata: {},
    }),

  setUploadSource: (source) => set({ uploadSource: source }),
}));
