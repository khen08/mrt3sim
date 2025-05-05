import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  IconUpload,
  IconFile,
  IconX,
  IconCheck,
  IconDownload,
  IconLoader2,
} from "@tabler/icons-react";
import { toast } from "@/components/ui/use-toast";
import { SAMPLE_CSV_PATH, SAMPLE_CSV_FILENAME } from "@/lib/constants";
import { useFileStore } from "@/store/fileStore";

interface CsvUploadProps {
  onFileSelect: (file: File | null, backendFilename: string | null) => void;
  initialFileName?: string | null;
}

const CsvUpload = ({
  onFileSelect,
  initialFileName = null,
}: CsvUploadProps) => {
  // State from Zustand store
  const { uploadFile, uploadedFileObject } = useFileStore();

  // Local UI state
  const [fileName, setFileName] = useState<string | null>(initialFileName);
  const [isFileSelected, setIsFileSelected] = useState<boolean>(
    !!initialFileName
  );
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFile = useCallback(
    async (selectedFile: File) => {
      setIsUploading(true);
      setFileName(selectedFile.name);
      setIsFileSelected(true);

      const result = await uploadFile(selectedFile);

      if (result.success && result.filename) {
        setFileName(result.filename);
        setIsFileSelected(true);
        onFileSelect(selectedFile, result.filename);
      } else {
        setFileName(null);
        setIsFileSelected(false);
        onFileSelect(null, null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }

      setIsUploading(false);
    },
    [uploadFile, onFileSelect]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        handleUploadFile(selectedFile);
      }
    },
    [handleUploadFile]
  );

  const handleRemoveFile = useCallback(() => {
    setFileName(null);
    setIsFileSelected(false);
    onFileSelect(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onFileSelect]);

  const displayFileName = fileName;
  const showUploadUI = !isFileSelected && !isUploading;
  const showSelectedUI = isFileSelected && !isUploading;
  const showUploadingUI = isUploading;

  return (
    <div className="space-y-6">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center min-h-[200px] flex items-center justify-center">
        <input
          type="file"
          accept=".csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isUploading}
        />
        {showUploadingUI && (
          <div className="space-y-4 text-center">
            <IconLoader2
              size={48}
              className="text-gray-400 mx-auto animate-spin"
            />
            <p className="text-lg font-medium">
              Uploading {displayFileName}...
            </p>
            <p className="text-sm text-gray-500 mt-1">Please wait</p>
          </div>
        )}
        {showUploadUI && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <IconUpload size={48} className="text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium">Upload CSV file</p>
              <p className="text-sm text-gray-500 mt-1">
                Drag and drop or click to browse
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Browse Files
            </Button>
          </div>
        )}
        {showSelectedUI && displayFileName && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <IconFile size={48} className="text-mrt-blue" />
            </div>
            <div>
              <p className="text-lg font-medium">{displayFileName}</p>
              <p className="text-sm text-green-600 font-medium">
                Successfully Uploaded
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={handleRemoveFile}
                className="flex items-center gap-1"
                disabled={isUploading}
              >
                <IconX size={16} />
                <span>Remove</span>
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1"
                disabled={isUploading}
              >
                <IconUpload size={16} />
                <span>Change File</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500">
        <p className="font-medium mb-2">Required Format:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>CSV file with comma-separated values</li>
          <li>First column should contain time values (format: HH:MM)</li>
          <li>
            Column headers should represent origin-destination pairs (format:
            fromStation;toStation)
          </li>
          <li>
            Each cell should contain passenger count for that time and OD pair
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CsvUpload;
