/**
 * Generated region engine for ForgeLoop documentation.
 * Provides functions for managing BEGIN/END markers in Markdown files.
 */

/**
 * Returns an array of byte offsets where `marker` appears in `content`.
 * 
 * @param {string} content - The content to search within
 * @param {string} marker - The string to search for
 * @returns {number[]} Array of indices where the marker appears
 */
export function findAllOccurrences(content, marker) {
  const occurrences = [];
  let i = 0;
  while ((i = content.indexOf(marker, i)) !== -1) {
    occurrences.push(i);
    i += marker.length;
  }
  return occurrences;
}

/**
 * Validates that exactly one BEGIN/END marker pair exists for the given region.
 * 
 * @param {Object} options
 * @param {string} options.content - The file content
 * @param {string} options.relPath - The relative path of the file (for error messages)
 * @param {string} options.region - The region identifier
 * @returns {Object} Result object indicating validity and details
 */
export function requireGeneratedRegion({ content, relPath, region }) {
  const beginMarker = `<!-- BEGIN FORGELOOP GENERATED: ${region} -->`;
  const endMarker = `<!-- END FORGELOOP GENERATED: ${region} -->`;
  
  const begins = findAllOccurrences(content, beginMarker);
  const ends = findAllOccurrences(content, endMarker);

  if (begins.length === 0) {
    return { valid: false, code: 'DOC_GENERATED_REGION_MISSING', message: `Missing begin marker for region ${region} in ${relPath}` };
  }
  if (begins.length > 1) {
    return { valid: false, code: 'DOC_GENERATED_REGION_DUPLICATE', message: `Multiple begin markers for region ${region} in ${relPath}` };
  }
  if (ends.length !== 1) {
    return { valid: false, code: 'DOC_GENERATED_REGION_INVALID', message: `Invalid end marker count for region ${region} in ${relPath} (expected 1, got ${ends.length})` };
  }
  if (ends[0] < begins[0]) {
    return { valid: false, code: 'DOC_GENERATED_REGION_INVALID', message: `End marker appears before begin marker for region ${region} in ${relPath}` };
  }

  return {
    valid: true,
    beginIndex: begins[0],
    endIndex: ends[0],
    beginMarker,
    endMarker
  };
}

/**
 * Discovers all generated region markers in content.
 * 
 * @param {string} content - The file content
 * @returns {Array<{region: string, beginIndex: number}>} Array of discovered regions
 */
export function findGeneratedRegions(content) {
  const regex = /<!-- BEGIN FORGELOOP GENERATED: ([a-zA-Z0-9_:.@-]+) -->/g;
  const regions = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    regions.push({
      region: match[1],
      beginIndex: match.index
    });
  }
  return regions;
}

/**
 * Validates regions against expected regions, ensuring no missing, duplicate, unknown, or nested regions.
 * 
 * @param {Object} options
 * @param {string} options.content - The file content
 * @param {string} options.relPath - The relative path of the file
 * @param {string[]|Set<string>} options.expectedRegions - The regions that are expected to exist
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateGeneratedRegions({ content, relPath, expectedRegions }) {
  const errors = [];
  const expectedSet = new Set(expectedRegions);
  
  const regionDataList = [];
  
  // Check expected regions
  for (const region of expectedSet) {
    const result = requireGeneratedRegion({ content, relPath, region });
    if (!result.valid) {
      errors.push(`${result.code}: ${result.message}`);
    } else {
      regionDataList.push({ region, ...result });
    }
  }

  // Check unknown regions
  const foundRegions = findGeneratedRegions(content);
  for (const found of foundRegions) {
    if (!expectedSet.has(found.region)) {
      errors.push(`DOC_GENERATED_REGION_UNKNOWN: Unknown generated region "${found.region}" found in "${relPath}"`);
    }
  }

  // Check for nested regions
  regionDataList.sort((a, b) => a.beginIndex - b.beginIndex);
  for (let i = 0; i < regionDataList.length - 1; i++) {
    const current = regionDataList[i];
    const next = regionDataList[i+1];
    
    if (next.beginIndex < current.endIndex) {
      errors.push(`DOC_GENERATED_REGION_NESTED: Region "${next.region}" is nested inside region "${current.region}" in "${relPath}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Replaces the content between BEGIN and END markers for a region.
 * 
 * @param {Object} options
 * @param {string} options.content - The original file content
 * @param {string} options.region - The region to replace
 * @param {string} options.newBody - The new content to insert
 * @returns {string} The updated content string
 * @throws {Error} If region markers are not valid
 */
export function replaceGeneratedRegion({ content, region, newBody }) {
  const result = requireGeneratedRegion({ content, relPath: 'unknown', region });
  if (!result.valid) {
    throw new Error(`Cannot replace region: ${result.message}`);
  }
  
  const before = content.substring(0, result.beginIndex + result.beginMarker.length);
  const after = content.substring(result.endIndex);
  
  return `${before}\n\n${newBody}\n\n${after}`;
}

/**
 * Compares the existing body of a region to the expected body.
 * 
 * @param {Object} options
 * @param {string} options.content - The file content
 * @param {string} options.region - The region to check
 * @param {string} options.expectedBody - The expected content for the region
 * @returns {Object} Comparison result { match: boolean, existing: string, expected: string }
 * @throws {Error} If region markers are not valid
 */
export function compareGeneratedRegion({ content, region, expectedBody }) {
  const result = requireGeneratedRegion({ content, relPath: 'unknown', region });
  if (!result.valid) {
    throw new Error(`Cannot compare region: ${result.message}`);
  }
  
  const bodyStart = result.beginIndex + result.beginMarker.length;
  const existing = content.substring(bodyStart, result.endIndex).trim();
  const expected = expectedBody.trim();
  
  return {
    match: existing === expected,
    existing,
    expected
  };
}
