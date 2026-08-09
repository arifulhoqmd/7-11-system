import { normalizeMasterDataset } from "./normalize.js";

export const MASTER_DATASET_URL = new URL(
  "../../data/7eleven_staff_training_master_dataset_v2_2026-08-09.json",
  import.meta.url,
);

export class DatasetLoadError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "DatasetLoadError";
  }
}

export async function loadMasterDataset({
  url = MASTER_DATASET_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new DatasetLoadError("This browser does not provide the Fetch API.");
  }

  let response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    throw new DatasetLoadError(
      "Could not load the master dataset. Run the project through a local HTTP server.",
      { cause: error },
    );
  }

  if (!response?.ok) {
    const status = response?.status ? ` (HTTP ${response.status})` : "";
    throw new DatasetLoadError(`Master dataset request failed${status}.`);
  }

  let rawDataset;
  try {
    rawDataset = await response.json();
  } catch (error) {
    throw new DatasetLoadError("The master dataset is not valid JSON.", {
      cause: error,
    });
  }

  return normalizeMasterDataset(rawDataset);
}
