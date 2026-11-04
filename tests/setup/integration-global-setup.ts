import { resetTestSchema } from "./reset-test-schema";

export default function setup(): void {
  process.loadEnvFile(".env");
  resetTestSchema();
}
