export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
}
