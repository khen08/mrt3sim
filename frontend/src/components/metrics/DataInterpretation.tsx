import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconInfoCircle } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface DataInterpretationProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const DataInterpretation: React.FC<DataInterpretationProps> = ({
  title = "Data Interpretation",
  children,
  className = "",
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 rounded-full p-0 ${className}`}
          aria-label="View data interpretation"
        >
          <IconInfoCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" side="top">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">{title}</h4>
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DataInterpretation; 