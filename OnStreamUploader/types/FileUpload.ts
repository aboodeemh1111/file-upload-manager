export interface FileUpload {
  id?: string;
  name: string;
  uri: string;
  type: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "completed" | "failed" | "paused";
  downloadUrl?: string;
  error?: string | null;
  createdAt?: number;
  updatedAt?: number;
  fileId: string;

  // Optional fields for backward compatibility
  priority?: "high" | "normal" | "low";
  retryCount?: number;
  completedAt?: number;
  startedAt?: number;
  addedAt?: string;
}
