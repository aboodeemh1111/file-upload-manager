export interface FileUpload {
  fileId: string;
  uri: string;
  name: string;
  size: number;
  type: string;
  status: "queued" | "uploading" | "paused" | "completed" | "failed";
  progress: number;
  priority: "high" | "normal" | "low";
  error: string | null;
  retryCount: number;
}
