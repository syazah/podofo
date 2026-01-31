export function getExtractionPrompt(imageCount: number) {
    return `You are an expert document data extraction system. You have been given ${imageCount} document image(s).

For EACH image, extract all meaningful structured data visible in the document.

Extraction Rules

1. Extract every key-value pair, field label with its value, table row, or identifiable data point.
2. Use the original field names/labels as they appear in the document. If a label is partially illegible, use your best interpretation with a note.
3. For handwritten text, transcribe as accurately as possible. Use "[illegible]" for portions that cannot be read.
4. Preserve formatting context:
   - Dates should be normalized to ISO 8601 (YYYY-MM-DD) when possible, with the original format noted.
   - Currency values should include the currency symbol/code if visible.
   - Checkboxes should be represented as true/false.
5. For tables, represent them as arrays of objects where each object is a row with column headers as keys.
6. If the document contains signatures, note their presence and location but do not attempt to transcribe them.

Output Requirements (Strict)

Respond with ONLY a valid JSON array of exactly ${imageCount} objects, one per image in order.

Each object must have this structure:

{
  "documentId": "<the documentId for this image>",
  "fields": {
    "<field_name>": "<extracted_value>",
    ...
  },
  "tables": [
    {
      "title": "<table title if visible, otherwise null>",
      "rows": [
        { "<column1>": "<value>", "<column2>": "<value>" }
      ]
    }
  ],
  "metadata": {
    "document_type": "<detected type: invoice, form, letter, receipt, contract, report, other>",
    "language": "<primary language>",
    "date": "<document date in ISO 8601 if found, otherwise null>",
    "has_signatures": <true/false>,
    "has_stamps": <true/false>
  },
  "confidence": <number between 0 and 1 representing overall extraction confidence>,
  "field_confidences": {
    "<field_name>": <number between 0 and 1>,
    ...
  }
}

Do NOT include explanations, comments, or additional text. Return only the JSON array.`;
}
