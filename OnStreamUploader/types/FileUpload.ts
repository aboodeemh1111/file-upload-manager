export interface FileUpload {
  fileId: string;
  uri: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "completed" | "queued" | "paused" | "failed" | "error";
  progress: number;
  priority: "high" | "normal" | "low";
  error: string | null;
  retryCount: number;
  completedAt?: number;
  startedAt?: number;
  addedAt: string;
  downloadUrl?: string;
}
