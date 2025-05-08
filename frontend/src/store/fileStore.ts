import { create } from "zustand";
import { toast } from "@/components/ui/use-toast";
import { UPLOAD_CSV_ENDPOINT, API_BASE_URL } from "@/lib/constants";
import Papa from "papaparse";

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

export type ValidationStatus = "none" | "pending" | "valid" | "invalid";

// Dynamically generate the expected OD pair headers
const generateExpectedHeaders = (): string[] => {
  const headers: string[] = ["DATETIME"];
  const stationCount = 13; // Assuming 13 stations

  for (let i = 1; i <= stationCount; i++) {
    for (let j = 1; j <= stationCount; j++) {
      if (i !== j) {
        headers.push(`${i},${j}`);
      }
    }
  }
  return headers;
};

const EXPECTED_HEADERS = generateExpectedHeaders();

interface FileState {
  // File state
  uploadedFileObject: File | null;
  uploadedFileName: string | null;
  uploadStatus: UploadStatus | null;
  uploadSource: UploadSource;
  fileMetadata: FileMetadata;
  validationStatus: ValidationStatus;
  validationErrors: string[];

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
  validateFile: (file: File) => Promise<boolean>;
  setUploadedFileObject: (file: File | null) => void;
  setUploadStatus: (status: UploadStatus | null) => void;
  resetFileState: () => void;
  setUploadSource: (source: UploadSource) => void;
  setFileMetadata: (metadata: Partial<FileMetadata>) => void;
  updateFileMetadata: (updates: Partial<FileMetadata>) => void;
  clearValidationErrors: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  uploadedFileObject: null,
  uploadedFileName: null,
  uploadStatus: null,
  uploadSource: null,
  fileMetadata: {},
  validationStatus: "none",
  validationErrors: [],

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

  clearValidationErrors: () => set({ validationErrors: [] }),

  validateFile: async (file: File): Promise<boolean> => {
    set({ validationStatus: "pending" });

    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const errors: string[] = [];
          const actualHeaders = results.meta.fields || [];

          // Check for parsing errors during Papaparse processing
          if (results.errors && results.errors.length > 0) {
            errors.push(
              ...results.errors.map(
                (err) =>
                  `Parsing Error on Line ${err.row}: ${
                    err.message || "Unknown CSV parsing error"
                  }`
              )
            );
          }

          // 1. Validate Headers Existence and Order
          if (actualHeaders.length !== EXPECTED_HEADERS.length) {
            errors.push(
              `Incorrect number of columns. Expected ${EXPECTED_HEADERS.length}, found ${actualHeaders.length}.`
            );
          } else {
            const incorrectHeaders: string[] = [];
            for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
              if (actualHeaders[i] !== EXPECTED_HEADERS[i]) {
                incorrectHeaders.push(
                  `Position ${i + 1}: Expected '${
                    EXPECTED_HEADERS[i]
                  }', Found '${actualHeaders[i]}'`
                );
              }
            }
            if (incorrectHeaders.length > 0) {
              // Limit the number of incorrect headers shown for brevity
              const limitedIncorrect = incorrectHeaders.slice(0, 5);
              errors.push(
                `Incorrect headers or order found (showing first ${
                  limitedIncorrect.length
                }): ${limitedIncorrect.join(",")}${
                  incorrectHeaders.length > 5 ? "..." : ""
                }`
              );
            }
          }

          // 2. Validate Data Types (Only if headers seem okay)
          if (errors.length === 0 && results.data && results.data.length > 0) {
            const sampleSize = Math.min(10, results.data.length);
            for (let i = 0; i < sampleSize; i++) {
              const row = results.data[i] as any;
              const rowNum = i + 2; // Account for header row + 0-based index

              // Validate DATETIME format (assuming YYYY-MM-DD HH:MM:SS)
              const dateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
              if (row.DATETIME && !dateTimeRegex.test(row.DATETIME)) {
                errors.push(
                  `Row ${rowNum}: Invalid DATETIME format '${row.DATETIME}'. Expected 'YYYY-MM-DD HH:MM:SS'.`
                );
              }

              // Validate OD pair columns (should be numbers or empty)
              for (const header of actualHeaders) {
                if (header !== "DATETIME") {
                  const value = row[header];
                  // Allow empty strings or check for non-negative integers
                  if (
                    value !== "" &&
                    value !== null &&
                    value !== undefined &&
                    (isNaN(Number(value)) || Number(value) < 0)
                  ) {
                    errors.push(
                      `Row ${rowNum}, Column '${header}': Invalid value '${value}'. Expected a non-negative number or empty.`
                    );
                    // Break inner loop if one error is found in a row for brevity
                    break;
                  }
                }
              }
            }
          } else if (errors.length === 0 && results.data.length === 0) {
            errors.push("CSV file contains no data rows.");
          }

          // Update validation status based on errors
          if (errors.length > 0) {
            // Limit total number of errors shown
            const limitedErrors = errors.slice(0, 10);
            set({
              validationStatus: "invalid",
              validationErrors: [
                ...limitedErrors,
                ...(errors.length > 10 ? ["... (more errors exist)"] : []),
              ],
            });
            resolve(false);
          } else {
            set({ validationStatus: "valid", validationErrors: [] });
            resolve(true);
          }
        },
        error: (error) => {
          console.error("PapaParse Error:", error);
          set({
            validationStatus: "invalid",
            validationErrors: [`Failed to parse CSV file: ${error.message}`],
          });
          resolve(false);
        },
      });
    });
  },

  // Upload a file to the server
  uploadFile: async (file, source = "main-upload") => {
    set({
      uploadedFileObject: file,
      uploadedFileName: file.name,
      uploadSource: source,
      fileMetadata: {
        ...get().fileMetadata,
        isInherited: false,
        isRequired: false,
      },
      uploadStatus: null,
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
          validationStatus: "valid",
          validationErrors: [],
        });
        return { success: true, filename: data.filename };
      } else {
        const errorMessage = data.error || "Unknown error during upload";
        const errorDetails = data.details || [];
        const errorType = errorMessage.includes("Invalid file")
          ? "format_error"
          : "server_error";

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
          message: "Network error occurred during upload",
          errorType: "network_error",
        },
      });
      return {
        success: false,
        error: "Network error occurred during upload",
        errorType: "network_error",
      };
    }
  },

  // Reset file state completely
  resetFileState: () =>
    set({
      uploadedFileObject: null,
      uploadedFileName: null,
      uploadStatus: null,
      uploadSource: null,
      fileMetadata: {},
      validationStatus: "none",
      validationErrors: [],
    }),

  setUploadSource: (source) => set({ uploadSource: source }),
}));
