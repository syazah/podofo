export function getExtractionPrompt(imageCount: number) {
  return `Extract all visible data from ${imageCount === 1 ? 'the document image' : `all ${imageCount} document images`}.

**Instructions:**
- Extract ALL text, numbers, dates, and structured data you can see
- The data is presented as whole
- For tables, extract each row as a separate entry
- For handwritten text, transcribe as accurately as possible
- If text is unclear, include it with [uncertain] flag

**Output Format:**
Return a JSON array with one object per image:

[
  {
    "image_index": 1,
    "document_type": "invoice|receipt|form|letter|contract|report|table|other",
    "extracted_data": <complete extracted data in paragraph>
  }
]

Return ONLY valid JSON. No markdown, no explanations.`;
}