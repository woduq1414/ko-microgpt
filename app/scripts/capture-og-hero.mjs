import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = 4173
const SERVER_URL = `http://${HOST}:${PORT}`
const VIEWPORT_WIDTH = 1200
const VIEWPORT_HEIGHT = 630
const SERVER_READY_TIMEOUT_MS = 30_000
const SERVER_POLL_INTERVAL_MS = 300
const SERVER_STOP_TIMEOUT_MS = 5_000

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(scriptDir, '..')
const outputPath = path.join(appDir, 'public', 'og', 'hero.png')
const outputDir = path.dirname(outputPath)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const checkServerReady = () =>
  new Promise((resolve) => {
    const request = http.get(SERVER_URL, (response) => {
      response.resume()
      resolve((response.statusCode ?? 500) < 500)
    })

    request.on('error', () => resolve(false))
    request.setTimeout(2_000, () => {
      request.destroy()
      resolve(false)
    })
  })

const startViteServer = () => {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const serverProcess = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', HOST, '--port', String(PORT), '--strictPort'],
    {
      cwd: appDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  const logs = []
  const pushLog = (chunk) => {
    const lines = chunk
      .toString()
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
    logs.push(...lines)
    if (logs.length > 200) {
      logs.splice(0, logs.length - 200)
    }
  }

  serverProcess.stdout.on('data', pushLog)
  serverProcess.stderr.on('data', pushLog)

  return { serverProcess, logs }
}

const waitForServerReady = async (serverProcess, logs) => {
  const startTime = Date.now()
  while (Date.now() - startTime < SERVER_READY_TIMEOUT_MS) {
    if (serverProcess.exitCode !== null) {
      const logTail = logs.slice(-20).join('\n')
      throw new Error(`Vite server exited before it became ready.\n${logTail}`)
    }

    const ready = await checkServerReady()
    if (ready) {
      return
    }

    await sleep(SERVER_POLL_INTERVAL_MS)
  }

  const logTail = logs.slice(-20).join('\n')
  throw new Error(`Timed out waiting for ${SERVER_URL}.\n${logTail}`)
}

const stopServer = async (serverProcess) => {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (serverProcess.exitCode === null) {
        serverProcess.kill('SIGKILL')
      }
    }, SERVER_STOP_TIMEOUT_MS)

    serverProcess.once('close', () => {
      clearTimeout(timeout)
      resolve()
    })

    serverProcess.kill('SIGTERM')
  })
}

const captureHeroImage = async () => {
  await mkdir(outputDir, { recursive: true })

  const { serverProcess, logs } = startViteServer()
  let browser = null

  try {
    await waitForServerReady(serverProcess, logs)

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      },
    })

    await context.addCookies([
      {
        name: 'microgpt_lang',
        value: 'en',
        url: SERVER_URL,
        sameSite: 'Lax',
      },
    ])

    const page = await context.newPage()
    await page.goto(SERVER_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForSelector('#hero', { state: 'visible', timeout: 15_000 })
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
    })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: outputPath,
      type: 'png',
    })
    await context.close()

    console.log(`[og:image] Generated ${outputPath}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const logTail = logs.slice(-20).join('\n')
    console.error('[og:image] Failed to capture hero image.')
    console.error(message)
    if (logTail) {
      console.error('[og:image] Recent Vite logs:')
      console.error(logTail)
    }
    process.exitCode = 1
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
    await stopServer(serverProcess)
  }
}

await captureHeroImage()
