import { readFile } from "node:fs/promises";

export const DATASET_URL = new URL(
  "../data/7eleven_staff_training_master_dataset_v2_2026-08-09.json",
  import.meta.url,
);

export async function readRawDataset() {
  return JSON.parse(await readFile(DATASET_URL, "utf8"));
}
