import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  IconUpload,
  IconFile,
  IconX,
  IconCheck,
  IconDownload,
  IconLoader2,
  IconAlertCircle,
} from "@tabler/icons-react";
import { toast } from "@/components/ui/use-toast";
import { SAMPLE_CSV_PATH, SAMPLE_CSV_FILENAME } from "@/lib/constants";
import { useFileStore } from "@/store/fileStore";
import { useSimulationStore } from "@/store/simulationStore";

interface CsvUploadProps {
  onFileSelect: (file: File | null, backendFilename: string | null) => void;
  initialFileName?: string | null;
}

const CsvUpload = ({
  onFileSelect,
  initialFileName = null,
}: CsvUploadProps) => {
  // State from Zustand store
  const {
    uploadFile,
    uploadedFileObject,
    uploadedFileName,
    uploadStatus,
    uploadSource,
  } = useFileStore();

  // Get relevant state from simulation store to prevent duplicate UI
  const nextRunFilename = useSimulationStore((state) => state.nextRunFilename);
  const hasResults = useSimulationStore(
    (state) =>
      state.simulationResult !== null && state.simulationResult.length > 0
  );

  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If this component shouldn't show its UI, return null
  // Added checks to prevent duplicate upload components when file is handled elsewhere
  if (
    uploadSource === "settings-change" || // Don't show when settings card is handling the upload
    nextRunFilename !== null // Don't show when a file is already selected for next run
  ) {
    return null;
  }

  // Handle file input change
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        const result = await uploadFile(file, "main-upload");
        if (result.success && result.filename) {
          onFileSelect(file, result.filename);

          toast({
            title: "File Uploaded Successfully",
            description: `${file.name} is ready for simulation.`,
            variant: "default",
          });
        } else {
          if (result.errorType === "format_error") {
            toast({
              title: "Invalid CSV Format",
              description:
                result.error || "The CSV file has an invalid format.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Upload Failed",
              description: result.error || "An error occurred during upload.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Error in file upload:", error);
        toast({
          title: "Upload Error",
          description: "An unexpected error occurred during upload.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [onFileSelect, uploadFile]
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
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];

        // Check if file is csv
        if (!file.name.toLowerCase().endsWith(".csv")) {
          toast({
            title: "Invalid File Type",
            description: "Please upload a CSV file.",
            variant: "destructive",
          });
          return;
        }

        setIsUploading(true);
        try {
          const result = await uploadFile(file, "main-upload");
          if (result.success && result.filename) {
            onFileSelect(file, result.filename);

            toast({
              title: "File Uploaded Successfully",
              description: `${file.name} is ready for simulation.`,
              variant: "default",
            });
          } else {
            if (result.errorType === "format_error") {
              toast({
                title: "Invalid CSV Format",
                description:
                  result.error || "The CSV file has an invalid format.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Upload Failed",
                description: result.error || "An error occurred during upload.",
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error("Error in file upload:", error);
          toast({
            title: "Upload Error",
            description: "An unexpected error occurred during upload.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      }
    },
    [onFileSelect, uploadFile]
  );

  // Handle file removal
  const handleRemoveFile = useCallback(() => {
    useFileStore.getState().resetUploadState();
    onFileSelect(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    toast({
      title: "File Removed",
      description: "The file has been removed.",
      variant: "default",
    });
  }, [onFileSelect]);

  // Handle manual file selection click
  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle sample file download
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
  const isFileSelected = !!uploadedFileObject;

  // Render the upload UI
  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      {/* Upload area when no file is selected */}
      {!isFileSelected && (
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
        >
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <IconUpload size={36} className="text-muted-foreground/60" />
            <div>
              <p className="text-sm font-medium">
                <span className="text-primary font-semibold hover:underline cursor-pointer">
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
              <IconDownload size={14} className="mr-1" /> Download Sample CSV
            </Button>
          </div>
        </div>
      )}

      {/* Uploaded file info */}
      {isFileSelected && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <IconFile size={24} className="text-primary" />
              <div>
                <p className="text-sm font-medium">{uploadedFileName}</p>
                <p className="text-xs text-muted-foreground">
                  Ready for simulation
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveFile}
              className="h-8 px-2"
            >
              <IconX size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Upload status */}
      {uploadStatus && (
        <div
          className={`mt-4 p-3 rounded-md ${
            uploadStatus.success
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <div className="flex items-start space-x-2">
            {uploadStatus.success ? (
              <IconCheck size={18} className="flex-shrink-0" />
            ) : (
              <IconAlertCircle size={18} className="flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">{uploadStatus.message}</p>
              {uploadStatus.details && uploadStatus.details.length > 0 && (
                <ul className="mt-1 text-xs list-disc list-inside">
                  {uploadStatus.details.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center space-y-2">
            <IconLoader2 size={24} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CsvUpload;
