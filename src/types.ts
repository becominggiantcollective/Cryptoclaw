export interface PaidTaskRequest {
  requester: string;
  topic: string;
  depth?: "quick" | "standard" | "deep";
  chain?: string;
}

export interface PaidTaskResult {
  report: string;
  confidence: number;
  sources: string[];
  generatedAt: string;
}

export interface ReputationUpdate {
  subject: string;
  scoreDelta: bigint;
  reason: string;
}

export interface ValidationRecord {
  subject: string;
  payloadUri: string;
  passed: boolean;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
