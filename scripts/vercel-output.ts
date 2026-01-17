import { nodeFileTrace } from '@vercel/nft'
import { mkdir, rm, copyFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()

const resolveFromRoot = (...parts: string[]) => path.join(projectRoot, ...parts)

const copyDir = async (srcDir: string, destDir: string) => {
  await mkdir(destDir, { recursive: true })
  const entries = await (await import('node:fs/promises')).readdir(srcDir, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const src = path.join(srcDir, entry.name)
      const dest = path.join(destDir, entry.name)
      if (entry.isDirectory()) {
        await copyDir(src, dest)
      } else if (entry.isFile()) {
        await mkdir(path.dirname(dest), { recursive: true })
        await copyFile(src, dest)
      }
    }),
  )
}

const writeJson = async (filePath: string, data: unknown) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2))
}

const main = async () => {
  const outDir = resolveFromRoot('.vercel/output')
  const staticDir = path.join(outDir, 'static')
  const functionDir = path.join(outDir, 'functions/ssr.func')

  // Clean output directory
  await rm(outDir, { recursive: true, force: true })

  // Copy client build output to static
  await copyDir(resolveFromRoot('dist/client'), staticDir)

  // Trace server bundle dependencies and copy them into the function directory
  const serverEntry = resolveFromRoot('dist/server/server.js')
  const trace = await nodeFileTrace([serverEntry], {
    base: projectRoot,
  })

  await mkdir(functionDir, { recursive: true })

  // Copy all traced files into the function directory, preserving paths from project root
  await Promise.all(
    Array.from(trace.fileList).map(async (file) => {
      const src = resolveFromRoot(file)
      const dest = path.join(functionDir, file)
      await mkdir(path.dirname(dest), { recursive: true })
      await copyFile(src, dest)
    }),
  )

  // Vercel serverless function entry (Node runtime) that adapts req/res to fetch()
  await writeFile(
    path.join(functionDir, 'index.mjs'),
    `import server from './dist/server/server.js'\n\nconst toRequest = async (req) => {\n  const proto = req.headers['x-forwarded-proto'] ?? 'https'\n  const host = req.headers['x-forwarded-host'] ?? req.headers.host\n  const url = new URL(req.url ?? '/', \`\${proto}://\${host}\`)\n\n  const headers = new Headers()\n  for (const [key, value] of Object.entries(req.headers)) {\n    if (typeof value === 'string') headers.set(key, value)\n    else if (Array.isArray(value)) headers.set(key, value.join(','))\n  }\n\n  const method = req.method ?? 'GET'\n  const body = method === 'GET' || method === 'HEAD'\n    ? undefined\n    : await new Promise((resolve, reject) => {\n        const chunks = []\n        req.on('data', (c) => chunks.push(c))\n        req.on('end', () => resolve(Buffer.concat(chunks)))\n        req.on('error', reject)\n      })\n\n  return new Request(url, { method, headers, body })\n}\n\nexport default async function handler(req, res) {\n  const request = await toRequest(req)\n  const response = await server.fetch(request)\n\n  res.statusCode = response.status\n\n  // Headers (handle multiple set-cookie)\n  const setCookie = response.headers.getSetCookie?.() ?? []\n  for (const [k, v] of response.headers.entries()) {\n    if (k.toLowerCase() === 'set-cookie') continue\n    res.setHeader(k, v)\n  }\n  if (setCookie.length) res.setHeader('set-cookie', setCookie)\n\n  if (!response.body) {\n    res.end()\n    return\n  }\n\n  // Stream response body\n  const { Readable } = await import('node:stream')\n  Readable.fromWeb(response.body).pipe(res)\n}\n`,
  )

  // Function config
  await writeJson(path.join(functionDir, '.vc-config.json'), {
    runtime: 'nodejs22.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
  })

  // Routing config: serve static files first, then SSR for everything else
  await writeJson(path.join(outDir, 'config.json'), {
    version: 3,
    routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/ssr' }],
  })
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})


