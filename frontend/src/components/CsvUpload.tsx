import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconUpload,
  IconX,
  IconCheck,
  IconDownload,
  IconLoader2,
  IconAlertCircle,
  IconTrash,
  IconReplace,
} from "@tabler/icons-react";
import { toast } from "@/components/ui/use-toast";
import { SAMPLE_CSV_PATH, SAMPLE_CSV_FILENAME } from "@/lib/constants";
import { useFileStore } from "@/store/fileStore";
import { useSimulationStore } from "@/store/simulationStore";
import { cn, formatFileName } from "@/lib/utils";

interface CsvUploadProps {
  onFileSelect: (file: File | null, backendFilename: string | null) => void;
  initialFileName?: string | null;
  inSettingsCard?: boolean;
}

const CsvUpload = ({
  onFileSelect,
  initialFileName = null,
  inSettingsCard = false,
}: CsvUploadProps) => {
  // State from Zustand store
  const {
    uploadFile,
    uploadedFileObject,
    uploadedFileName,
    uploadStatus,
    uploadSource,
    validationStatus,
    validationErrors,
    validateFile,
    resetFileState,
  } = useFileStore();

  // Get relevant state from simulation store
  const nextRunFilename = useSimulationStore(
    (state: any) => state.nextRunFilename
  );
  const setSimulationNameDialogOpen = useSimulationStore(
    (state: any) => state.setSimulationNameDialogOpen
  );
  const simulatePassengers = useSimulationStore(
    (state: any) => state.simulatePassengers
  );
  const loadedSimulationId = useSimulationStore(
    (state: any) => state.loadedSimulationId
  );

  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If this should be hidden in main content view (not in settings card)
  if (
    !inSettingsCard &&
    (loadedSimulationId !== null || // Don't show in main content if simulation loaded
      uploadSource === "settings-change" ||
      nextRunFilename !== null)
  ) {
    // Always return null in main content if simulation is loaded
    return null;
  }

  // Shared file processing logic
  const processFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      setIsProcessing(true);
      useFileStore.setState({ validationStatus: "pending" });

      try {
        const isValid = await validateFile(file);

        if (isValid) {
          const uploadResult = await uploadFile(file, "main-upload");
          if (uploadResult.success && uploadResult.filename) {
            onFileSelect(file, uploadResult.filename);
          } else {
            onFileSelect(null, null);
            toast({
              title: "Upload Failed",
              description:
                uploadResult.error || "An error occurred during upload.",
              variant: "destructive",
            });
          }
        } else {
          onFileSelect(null, null);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        onFileSelect(null, null);
        toast({
          title: "Processing Error",
          description: "An unexpected error occurred.",
          variant: "destructive",
        });
        useFileStore.setState({
          validationStatus: "invalid",
          validationErrors: ["Unexpected processing error"],
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [validateFile, uploadFile, onFileSelect]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      processFile(file);
    },
    [processFile]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (!file.name.toLowerCase().endsWith(".csv")) {
          toast({
            title: "Invalid File Type",
            description: "Please upload a CSV file.",
            variant: "destructive",
          });
          return;
        }
        processFile(file);
      }
    },
    [processFile]
  );

  // Handle file removal/clearing state
  const handleClearFileState = useCallback(() => {
    resetFileState();
    onFileSelect(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({
      title: "File Cleared",
      description: "Upload state has been reset.",
      variant: "default",
    });
  }, [resetFileState, onFileSelect]);

  // Handle triggering file input
  const handleClickUpload = useCallback(() => {
    if (validationStatus !== "invalid") {
      fileInputRef.current?.click();
    }
  }, [validationStatus]);

  const handleReplaceFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle sample download
  const handleSampleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(SAMPLE_CSV_PATH);
      if (!response.ok) {
        throw new Error("Failed to download sample file");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = SAMPLE_CSV_FILENAME;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Sample Downloaded",
        description: "Sample CSV file downloaded successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error downloading sample file:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download the sample file.",
        variant: "destructive",
      });
    }
  }, []);

  // Determine UI states
  const showUploadArea =
    validationStatus !== "valid" &&
    validationStatus !== "invalid" &&
    !uploadedFileObject;
  const showFileInfo = validationStatus === "valid" && uploadedFileObject;
  const showErrorState = validationStatus === "invalid";

  return (
    <div className="space-y-4 csv-upload-area">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      {/* 1. Default Upload Area */}
      {showUploadArea && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/20"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickUpload}
          style={{ cursor: "pointer" }}
        >
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            {isProcessing ? (
              <>
                <IconLoader2 size={36} className="text-primary animate-spin" />
                <p className="text-sm font-medium">Validating...</p>
              </>
            ) : (
              <>
                <IconUpload size={36} className="text-muted-foreground/60" />
                <div>
                  <p className="text-sm font-medium">
                    <span className="text-primary font-semibold hover:underline">
                      Click to upload
                    </span>{" "}
                    or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV file with passenger flow data
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleSampleDownload}
                >
                  <IconDownload size={14} className="mr-1" /> Download Sample
                  CSV
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Valid File Info */}
      {showFileInfo && uploadedFileName && (
        <div className="border rounded-lg p-4 bg-green-50 border-green-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <IconCheck size={24} className="text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {formatFileName(uploadedFileName)}
                </p>
                <p className="text-xs text-green-700">
                  File validated successfully.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFileState}
              className="h-8 px-2 border-gray-300 hover:bg-gray-100"
            >
              <IconX size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* 3. Invalid File / Error State */}
      {showErrorState && (
        <div className="border rounded-lg p-4 bg-red-50 border-red-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <IconAlertCircle size={24} className="text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  {uploadedFileName
                    ? formatFileName(uploadedFileName)
                    : "Invalid File"}
                </p>
                <p className="text-xs text-red-700">
                  Validation failed. Please fix the issues below.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="icon"
                onClick={handleClearFileState}
                className="h-8 w-8"
                title="Remove File"
              >
                <IconTrash size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleReplaceFile}
                className="h-8 w-8 border-gray-300 hover:bg-gray-100 dark:text-black"
                title="Replace File"
              >
                <IconReplace size={16} />
              </Button>
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <ul className="list-disc pl-5 text-xs text-red-600 space-y-1 max-h-20 overflow-y-auto">
                {validationErrors.map((error: any, idx: any) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Generic Upload Status (e.g., network errors during upload) */}
      {uploadStatus &&
        !uploadStatus.success &&
        validationStatus !== "invalid" && (
          <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
            <div className="flex items-start space-x-2">
              <IconAlertCircle size={18} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  Upload Error: {uploadStatus.message}
                </p>
                {uploadStatus.details && uploadStatus.details.length > 0 && (
                  <ul className="mt-1 text-xs list-disc list-inside">
                    {uploadStatus.details.map((detail: any, idx: any) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearFileState}
                className="h-6 w-6 text-red-500 hover:bg-red-100 ml-auto"
                title="Clear Error"
              >
                <IconX size={14} />
              </Button>
            </div>
          </div>
        )}
    </div>
  );
};

export default CsvUpload;
