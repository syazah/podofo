export const projectConstants = {
    VALID_CLASSIFICATIONS: ["handwritten", "typed", "mixed"],
    BATCH_SIZE: 2,
    BUCKET: "pdfs",
    TARGET_DPI: 300,
    PDF_DEFAULT_DPI: 72,
    BATCH_API_THRESHOLD: 10,
    BATCH_CHUNK_SIZE: 2,
    BATCH_POLL_DELAY_MS: 30_000,
}

export const modelConstants = {
    GEMINI_PRO: "gemini-2.5-pro",
    GEMINI_FLASH: "gemini-2.5-flash"
}