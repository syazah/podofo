export interface BatchSubmitJobData {
  lotId: string;
  stage: "classification" | "extraction";
}

export interface BatchPollJobData {
  geminiJobName: string;
  lotId: string;
  stage: "classification" | "extraction";
  documentIds: string[];
}
