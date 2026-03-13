export interface LlmClientPort {
  generateJson(prompt: string): Promise<unknown>;
}
