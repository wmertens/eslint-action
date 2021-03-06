const request = require('./request')

const { GITHUB_SHA, GITHUB_EVENT_PATH, GITHUB_TOKEN, GITHUB_WORKSPACE, INPUT_FILES, INPUT_EXTENSIONS, INPUT_WARNINGS } = process.env
const event = require(GITHUB_EVENT_PATH)
const { repository } = event
const {
  owner: { login: owner }
} = repository
const { name: repo } = repository

const checkName = 'ESLint check'

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github.antiope-preview+json',
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  'User-Agent': 'eslint-action'
}

async function createCheck() {
  const body = {
    name: checkName,
    head_sha: GITHUB_SHA,
    status: 'in_progress',
    started_at: new Date()
  }

  const { data } = await request(`https://api.github.com/repos/${owner}/${repo}/check-runs`, {
    method: 'POST',
    headers,
    body
  })
  const { id } = data
  return id
}

const extensions = INPUT_EXTENSIONS ? INPUT_EXTENSIONS.split(',') : ['.js', '.jsx', '.tsx']
const files = INPUT_FILES ? INPUT_FILES.split(',') : ['.']
function eslint() {
  const eslint = require('eslint')

  const cli = new eslint.CLIEngine({
    extensions,
    ignorePath: '.gitignore'
  })
  const report = cli.executeOnFiles(['.'])
  // fixableErrorCount, fixableWarningCount are available too
  const { results, errorCount, warningCount } = report

  const levels = ['', 'warning', 'failure']

  let annotations = []
  const warnings = []
  const errors = []
  for (const result of results) {
    const { filePath, messages } = result
    const path = filePath.substring(GITHUB_WORKSPACE.length + 1)
    for (const msg of messages) {
      const { line, severity, ruleId, message } = msg
      const annotationLevel = levels[severity]
      const target = severity === 2 ? errors : warnings
      target.push({
        path,
        start_line: line,
        end_line: line,
        annotation_level: annotationLevel,
        message: `[${ruleId}] ${message}`
      })
    }
  }
  if (INPUT_WARNINGS) {
    annotations = errors.concat(warnings)
  } else {
    annotations = errors
  }
  if (errors.length) {
    console.log('\n\nErrors:\n\n')
    errors.slice(0, 50).map(m => console.log(`${m.path}:${m.start_line} ${m.message}`))
  }
  if (warnings.length) {
    console.log('\n\nWarnings:\n\n')
    warnings.slice(0, 50).map(m => console.log(`${m.path}:${m.start_line} ${m.message}`))
  }
  return {
    conclusion: errorCount > 0 ? 'failure' : 'success',
    output: {
      title: checkName,
      summary: `${errorCount} error(s), ${warningCount} warning(s) found`,
      // More than 20 annotations is pointless
      annotations: annotations.slice(0, 20)
    }
  }
}

async function updateCheck(id, conclusion, output) {
  const body = {
    name: checkName,
    head_sha: GITHUB_SHA,
    status: 'completed',
    completed_at: new Date(),
    conclusion,
    output
  }

  await request(`https://api.github.com/repos/${owner}/${repo}/check-runs/${id}`, {
    method: 'PATCH',
    headers,
    body
  })
}

function exitWithError(err) {
  console.error('Error', err.stack)
  if (err.data) {
    console.error(err.data)
  }
  process.exit(1)
}

async function run() {
  const id = await createCheck()
  try {
    const { conclusion, output } = eslint()
    console.log(output.summary)
    await updateCheck(id, conclusion, output)
    if (conclusion === 'failure') {
      process.exit(78)
    }
  } catch (err) {
    await updateCheck(id, 'failure')
    exitWithError(err)
  }
}

run().catch(exitWithError)
