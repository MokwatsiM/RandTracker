declare module 'pdf-parse-fork' {
  export default function pdf(data: Buffer): Promise<{ text: string; numpages: number; info: unknown }>;
}
