/**
 * Unit 24: Save/Load workspace content serialization
 *
 * Pure functions to convert planner state to/from JSON-safe objects
 * for persisting in workspace.content.
 */

// Re-declare the data types we serialize (avoids coupling to store internals)
interface WallConfig {
  id: string;
  length: number;
  anchors: Anchor[];
}

interface Anchor {
  type: 'sink' | 'cooktop' | 'oven';
  position: number;
  width: number;
}

interface GoldenRule {
  context: 'sink' | 'standard';
  width: number;
  moduleArticles: string[];
}

/**
 * The subset of PlannerState that gets persisted.
 * Excludes transient state (selectedModuleId, modules).
 */
export interface SerializablePlannerState {
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  layoutType: 'linear' | 'l-shaped';
  walls: WallConfig[];
  selectedCatalogId: number | null;
  goldenRules: GoldenRule[];
  floorToCeiling: boolean;
  useSidePanel200: boolean;
  useHood: boolean;
  sinkModuleWidth: 600 | 800;
  drawerHousingWidth: 400 | 600;
  variants: unknown[];
  selectedVariantIndex: number;
}

const SERIALIZATION_VERSION = 1;

interface SerializedWorkspaceContent {
  _version: number;
  roomWidth: number;
  roomDepth: number;
  wallHeight: number;
  layoutType: string;
  walls: WallConfig[];
  selectedCatalogId: number | null;
  goldenRules: GoldenRule[];
  floorToCeiling: boolean;
  useSidePanel200: boolean;
  useHood: boolean;
  sinkModuleWidth: 600 | 800;
  drawerHousingWidth: 400 | 600;
  variants: unknown[];
  selectedVariantIndex: number;
}

// ---------------------------------------------------------------------------
// Defaults (used when fields are missing during deserialization)
// ---------------------------------------------------------------------------
const DEFAULTS: SerializablePlannerState = {
  roomWidth: 3000,
  roomDepth: 2500,
  wallHeight: 2700,
  layoutType: 'linear',
  walls: [],
  selectedCatalogId: null,
  goldenRules: [],
  floorToCeiling: false,
  useSidePanel200: false,
  useHood: false,
  sinkModuleWidth: 600,
  drawerHousingWidth: 400,
  variants: [],
  selectedVariantIndex: 0,
};

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Convert planner state to a JSON-safe object suitable for workspace.content.
 *
 * Only data fields are serialized — transient UI state (selectedModuleId)
 * and API-loaded data (modules) are intentionally excluded.
 */
export function serializeState(
  state: SerializablePlannerState,
): Record<string, unknown> {
  const serialized: SerializedWorkspaceContent = {
    _version: SERIALIZATION_VERSION,
    roomWidth: state.roomWidth,
    roomDepth: state.roomDepth,
    wallHeight: state.wallHeight,
    layoutType: state.layoutType,
    walls: state.walls,
    selectedCatalogId: state.selectedCatalogId,
    goldenRules: state.goldenRules,
    floorToCeiling: state.floorToCeiling,
    useSidePanel200: state.useSidePanel200,
    useHood: state.useHood,
    sinkModuleWidth: state.sinkModuleWidth,
    drawerHousingWidth: state.drawerHousingWidth,
    variants: state.variants,
    selectedVariantIndex: state.selectedVariantIndex,
  };

  return serialized as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deserialize
// ---------------------------------------------------------------------------

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isValidLayoutType(value: unknown): value is 'linear' | 'l-shaped' {
  return value === 'linear' || value === 'l-shaped';
}

function isValidAnchorType(value: unknown): value is 'sink' | 'cooktop' | 'oven' {
  return value === 'sink' || value === 'cooktop' || value === 'oven';
}

function isValidGoldenRuleContext(value: unknown): value is 'sink' | 'standard' {
  return value === 'sink' || value === 'standard';
}

function parseAnchor(raw: unknown): Anchor | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (!isValidAnchorType(obj.type)) return null;
  if (!isNumber(obj.position)) return null;
  if (!isNumber(obj.width)) return null;

  return { type: obj.type, position: obj.position, width: obj.width };
}

function parseWall(raw: unknown): WallConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (!isString(obj.id)) return null;
  if (!isNumber(obj.length)) return null;

  const anchors: Anchor[] = [];
  if (Array.isArray(obj.anchors)) {
    for (const a of obj.anchors) {
      const parsed = parseAnchor(a);
      if (parsed) anchors.push(parsed);
    }
  }

  return { id: obj.id, length: obj.length, anchors };
}

function parseGoldenRule(raw: unknown): GoldenRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (!isValidGoldenRuleContext(obj.context)) return null;
  if (!isNumber(obj.width)) return null;

  const moduleArticles: string[] = [];
  if (Array.isArray(obj.moduleArticles)) {
    for (const article of obj.moduleArticles) {
      if (isString(article)) moduleArticles.push(article);
    }
  }

  return { context: obj.context, width: obj.width, moduleArticles };
}

/**
 * Restore planner state from saved workspace content.
 *
 * - Validates every field's type before accepting it
 * - Falls back to defaults for missing or invalid fields
 * - Handles backwards compatibility: new fields added in future versions
 *   will simply use their defaults when loading older saves
 */
export function deserializeState(
  content: Record<string, unknown>,
): Partial<SerializablePlannerState> {
  if (!content || typeof content !== 'object') {
    return { ...DEFAULTS };
  }

  const result: Partial<SerializablePlannerState> = {};

  // Room config
  result.roomWidth = isNumber(content.roomWidth)
    ? content.roomWidth
    : DEFAULTS.roomWidth;

  result.roomDepth = isNumber(content.roomDepth)
    ? content.roomDepth
    : DEFAULTS.roomDepth;

  result.wallHeight = isNumber(content.wallHeight)
    ? content.wallHeight
    : DEFAULTS.wallHeight;

  result.layoutType = isValidLayoutType(content.layoutType)
    ? content.layoutType
    : DEFAULTS.layoutType;

  // Walls
  if (Array.isArray(content.walls)) {
    const walls: WallConfig[] = [];
    for (const w of content.walls) {
      const parsed = parseWall(w);
      if (parsed) walls.push(parsed);
    }
    result.walls = walls;
  } else {
    result.walls = DEFAULTS.walls;
  }

  // Catalog
  result.selectedCatalogId =
    content.selectedCatalogId === null || isNumber(content.selectedCatalogId)
      ? (content.selectedCatalogId as number | null)
      : DEFAULTS.selectedCatalogId;

  // Golden rules
  if (Array.isArray(content.goldenRules)) {
    const rules: GoldenRule[] = [];
    for (const r of content.goldenRules) {
      const parsed = parseGoldenRule(r);
      if (parsed) rules.push(parsed);
    }
    result.goldenRules = rules;
  } else {
    result.goldenRules = DEFAULTS.goldenRules;
  }

  // Floor-to-ceiling
  result.floorToCeiling = content.floorToCeiling === true;

  // СБ 200 side panels
  result.useSidePanel200 = content.useSidePanel200 === true;

  // Hood above cooktop
  result.useHood = content.useHood === true;

  // Sink module width
  result.sinkModuleWidth =
    content.sinkModuleWidth === 600 || content.sinkModuleWidth === 800
      ? content.sinkModuleWidth
      : DEFAULTS.sinkModuleWidth;

  // Drawer housing width
  result.drawerHousingWidth =
    content.drawerHousingWidth === 400 || content.drawerHousingWidth === 600
      ? content.drawerHousingWidth
      : DEFAULTS.drawerHousingWidth;

  // Variants (opaque data — accept arrays as-is)
  result.variants = Array.isArray(content.variants)
    ? content.variants
    : DEFAULTS.variants;

  // Selected variant index
  result.selectedVariantIndex = isNumber(content.selectedVariantIndex)
    ? content.selectedVariantIndex
    : DEFAULTS.selectedVariantIndex;

  return result;
}
