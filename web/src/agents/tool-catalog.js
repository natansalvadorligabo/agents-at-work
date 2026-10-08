/**
 * @typedef {import('../world/layout.js').StationName} StationName
 * @typedef {import('./poses.js').PoseName} PoseName
 * @typedef {import('#shared/protocol.js').ToolRecord} ToolRecord
 * @typedef {import('../i18n/translator.js').Translator} Translator
 *
 * @typedef {object} ToolCategory Where an agent goes and how it looks while a tool runs.
 * @property {StationName | null} station Null: the agent stays at its desk.
 * @property {PoseName} pose
 * @property {string} icon
 */

const CATEGORIES = /** @type {ReadonlyArray<ToolCategory & { pattern: RegExp }>} */ ([
  {
    pattern: /^(Read|Grep|Glob|LS|NotebookRead|Skill|ToolSearch)$/,
    station: 'bookshelf',
    pose: 'operating',
    icon: '📚',
  },
  { pattern: /^(Edit|Write|MultiEdit|NotebookEdit)$/, station: null, pose: 'typing', icon: '⌨️' },
  {
    pattern: /^(Bash|PowerShell|BashOutput|KillShell|Monitor|TaskStop)$/,
    station: 'rack',
    pose: 'operating',
    icon: '🖥️',
  },
  { pattern: /^(WebSearch|WebFetch)$/, station: 'globe', pose: 'operating', icon: '🌐' },
  { pattern: /^mcp__/, station: 'phone', pose: 'operating', icon: '📞' },
  { pattern: /^(Agent|Task|SendMessage|Workflow)$/, station: null, pose: 'waitingSeated', icon: '📨' },
  {
    pattern: /^(TodoWrite|TaskCreate|TaskUpdate|EnterPlanMode|ExitPlanMode)$/,
    station: 'whiteboard',
    pose: 'writingOnBoard',
    icon: '📝',
  },
  { pattern: /^AskUserQuestion$/, station: null, pose: 'waitingSeated', icon: '❓' },
])

/** @type {ToolCategory} */
const DEFAULT_CATEGORY = { station: null, pose: 'typing', icon: '🔧' }

/** Tools that hand work to a subagent; while they run the agent is waiting on someone else. */
export const DELEGATION_TOOLS = /^(Agent|Task)$/

/**
 * @param {string} tool
 * @returns {ToolCategory}
 * @example categoryOfTool('Bash').station // 'rack'
 */
export function categoryOfTool(tool) {
  return CATEGORIES.find(category => category.pattern.test(tool)) ?? DEFAULT_CATEGORY
}

/**
 * Human name of a tool: MCP tools read as "server: tool", delegation reads as "Delegated:".
 * @param {string} tool
 * @param {Translator} translator
 * @returns {string}
 * @example toolDisplayName('mcp__claude_ai_Gmail__send', translator) // 'Gmail: send'
 */
export function toolDisplayName(tool, translator) {
  if (DELEGATION_TOOLS.test(tool)) return translator.t('tool.delegated')
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (!mcp) return tool
  const server = (mcp[1] ?? '').replace(/^claude_ai_/, '').replace(/_/g, ' ')
  return `${server}: ${mcp[2]}`
}

/**
 * The speech bubble shown while a tool runs, e.g. "🖥️ Bash npm test".
 * @param {Pick<ToolRecord, 'tool' | 'summary'>} record
 * @param {Translator} translator
 * @returns {string}
 * @example toolBubbleText({ tool: 'Read', summary: 'app.ts' }, translator) // '📚 Read app.ts'
 */
export function toolBubbleText(record, translator) {
  const summary = record.summary ? ` ${record.summary}` : ''
  return `${categoryOfTool(record.tool).icon} ${toolDisplayName(record.tool, translator)}${summary}`
}
