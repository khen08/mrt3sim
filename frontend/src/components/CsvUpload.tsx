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
import {
  UPLOAD_CSV_ENDPOINT,
  SAMPLE_CSV_PATH,
  SAMPLE_CSV_FILENAME,
} from "@/lib/constants";

interface CsvUploadProps {
  onFileSelect: (file: File | null) => void;
  initialFileName?: string | null;
}

const CsvUpload = ({
  onFileSelect,
  initialFileName = null,
}: CsvUploadProps) => {
  const [fileName, setFileName] = useState<string | null>(initialFileName);
  const [isFileSelected, setIsFileSelected] = useState<boolean>(
    !!initialFileName
  );
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (selectedFile: File) => {
      setIsUploading(true);
      setFileName(selectedFile.name);
      setIsFileSelected(true);

      const formData = new FormData();
      formData.append("passenger_data_file", selectedFile);

      // console.log("Uploading file to /upload_csv:", selectedFile.name);
      toast({
        title: "Uploading File",
        description: `Uploading '${selectedFile.name}'. Please wait.`,
      });

      try {
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

        // console.log("File uploaded successfully:", result);
        setFileName(result.filename);
        setIsFileSelected(true);
        onFileSelect(selectedFile);

        toast({
          title: "Upload Successful",
          description: `File '${result.filename}' uploaded successfully.`,
          variant: "default",
        });
      } catch (error: any) {
        console.error("Error uploading file:", error);
        setFileName(null);
        setIsFileSelected(false);
        onFileSelect(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        toast({
          title: "Upload Failed",
          description:
            error.message || "Could not upload the file. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [onFileSelect]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        // console.log("File selected locally:", selectedFile.name);
        uploadFile(selectedFile);
      } else {
        // console.log("File selection cancelled or failed.");
      }
    },
    [uploadFile]
  );

  const handleRemoveFile = useCallback(() => {
    // console.log("Removing file selection in CsvUpload");
    setFileName(null);
    setIsFileSelected(false);
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onFileSelect]);

  const handleDownloadSample = () => {
    const link = document.createElement("a");
    link.href = SAMPLE_CSV_PATH;
    link.download = SAMPLE_CSV_FILENAME;
    document.body.appendChild(link);
    link.click();

    toast({
      title: "Sample Downloaded",
      description:
        "Sample CSV file downloaded. You can use this as a template.",
      variant: "default",
    });
  };

  const displayFileName = fileName;
  const showUploadUI = !isFileSelected && !isUploading;
  const showSelectedUI = isFileSelected && !isUploading;
  const showUploadingUI = isUploading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          onClick={handleDownloadSample}
          className="flex items-center gap-2"
        >
          <IconDownload size={16} />
          <span>Download Sample CSV</span>
        </Button>
        <div className="text-sm text-gray-500">
          Use this sample as a template for your own data
        </div>
      </div>

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
