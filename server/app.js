import config from './config'
import webpack from 'webpack'
import webpackConfig from './webpack.config.js'

import childProcess from 'child_process'
import dns from 'dns'
import http from 'http'
import net from 'net'

import isDev from './lib/env/is-dev'
import Koa from 'koa'
import log from './lib/logging/logger'
import path from 'path'
import thenify from 'thenify'

import Csrf from 'koa-csrf'
import csrfCookie from './lib/security/csrf-cookie'
import onlyWebClients from './lib/network/only-web-clients'
import koaBody from 'koa-body'
import koaCompress from 'koa-compress'
import koaConvert from 'koa-convert'
import koaError from 'koa-error'
import logMiddleware from './lib/logging/log-middleware'
import secureHeaders from './lib/security/headers'
import secureJson from './lib/security/json'
import sessionMiddleware from './lib/session/middleware'
import userIpsMiddleware from './lib/network/user-ips-middleware'
import userSessionsMiddleware from './lib/session/user-sessions-middleware'
import views from 'koa-views'

import pingRegistry from './lib/rally-point/ping-registry'
import routeCreator from './lib/rally-point/route-creator'

import { setStore, addMiddleware as fileStoreMiddleware } from './lib/file-upload'
import LocalFileStore from './lib/file-upload/local-filesystem'

if (!config.canonicalHost) {
  throw new Error('Configuration must contain canonicalHost')
}
if (
  !config.rallyPoint ||
  !config.rallyPoint.secret ||
  !(config.rallyPoint.local || config.rallyPoint.remote)
) {
  throw new Error('Configuration must contain rally-point settings')
}
if (config.rallyPoint.local) {
  if (!isDev) {
    throw new Error('local rally-point is only available in development mode')
  }

  if (!net.isIPv6(config.rallyPoint.local.address)) {
    throw new Error('local rally-point address must be IPv6-formatted')
  }

  log.info('Creating local rally-point process')
  const rallyPoint = childProcess.fork(
    path.join(__dirname, 'lib', 'rally-point', 'run-local-server.js'),
  )
  rallyPoint
    .on('error', err => {
      log.error('rally-point process error: ' + err)
      process.exit(1)
    })
    .on('exit', (code, signal) => {
      log.error(
        'rally-point process exited unexpectedly with code: ' + code + ', signal: ' + signal,
      )
      process.exit(1)
    })
}

if (!config.fileStore || !config.fileStore.filesystem) {
  throw new Error('Configuration must contain file storage settings')
}
setStore(new LocalFileStore(config.fileStore.filesystem))

const asyncLookup = thenify(dns.lookup)
const rallyPointServers = config.rallyPoint.local
  ? [config.rallyPoint.local]
  : config.rallyPoint.remote
const resolvedRallyPointServers = Promise.all(
  rallyPointServers.map(async s => {
    let v6
    try {
      v6 = await asyncLookup(s.address, { family: 6 })
    } catch (err) {
      log.warn('Warning: error looking up ' + s.address + ' for ipv6: ' + err)
    }

    let v4
    try {
      v4 = await asyncLookup(s.address, { family: 4 })
    } catch (err) {
      log.warn('Warning: error looking up ' + s.address + ' for ipv4: ' + err)
    }
    if (v4 && v4[1] === 6 && v6 && v6[0].startsWith('::ffff:')) {
      // v6 is an ipv6-mapped ipv4 address, so swap things around
      v4[0] = v6[0].slice('::ffff:'.length)
      v4[1] = 4
      v6[0] = undefined
    }

    if (!v4 && !v6) {
      throw new Error('Could not resolve ' + s.address)
    }

    return {
      address4: v4 && v4[1] === 4 ? `::ffff:${v4[0]}` : undefined,
      address6: v6 && v6[1] === 6 ? v6[0] : undefined,
      port: s.port,
      desc: s.desc,
    }
  }),
)

const routeCreatorConfig = config.rallyPoint.routeCreator || {}
const initRouteCreatorPromise = routeCreator.initialize(
  routeCreatorConfig.host || '::',
  routeCreatorConfig.port || 0,
  config.rallyPoint.secret,
)

const app = new Koa()
const port = config.httpPort
const compiler = webpack(webpackConfig)

app.keys = [config.sessionSecret]
app.proxy = config.httpsReverseProxy

app.on('error', err => {
  if (err.status && err.status < 500) return // likely an HTTP error (expected and fine)

  log.error({ err }, 'server error')
})

process.on('unhandledRejection', err => {
  log.error({ err }, 'unhandled rejection')
  if (err instanceof TypeError || err instanceof SyntaxError || err instanceof ReferenceError) {
    // These types are very unlikely to be handle-able properly, exit
    throw err
  }
  // Other promise rejections are likely less severe, leave the process up but log it
})

app
  .use(logMiddleware())
  .use(koaError()) // TODO(tec27): Customize error view
  .use(koaCompress())
  .use(views(path.join(__dirname, 'views'), { extension: 'jade' }))
  .use(koaBody())
  .use(koaConvert(sessionMiddleware))
  .use(onlyWebClients(csrfCookie()))
  .use(onlyWebClients(new Csrf()))
  .use(secureHeaders())
  .use(secureJson())
  .use(userIpsMiddleware())
  .use(userSessionsMiddleware())

const mainServer = http.createServer(app.callback())

import setupWebsockets from './websockets'
const { userSockets } = setupWebsockets(mainServer, app, sessionMiddleware)

if (isDev) {
  app.use(
    koaConvert(
      require('koa-webpack-dev-middleware')(compiler, {
        noInfo: true,
        publicPath: webpackConfig.output.publicPath,
      }),
    ),
  )
  app.use(koaConvert(require('koa-webpack-hot-middleware')(compiler)))
}

fileStoreMiddleware(app)

import createRoutes from './routes'
createRoutes(app, userSockets)

compiler.run = thenify(compiler.run)
const compilePromise = isDev ? Promise.resolve() : compiler.run()
if (!isDev) {
  log.info('In production mode, building assets...')
}

resolvedRallyPointServers
  .then(servers => {
    pingRegistry.setServers(servers)
    return initRouteCreatorPromise
  })
  .then(() => compilePromise)
  .then(stats => {
    if (stats) {
      if ((stats.errors && stats.errors.length) || (stats.warnings && stats.warnings.length)) {
        throw new Error(stats.toString())
      }

      const statStr = stats.toString({ colors: true })
      log.info(`Webpack stats:\n${statStr}`)
    }

    mainServer.listen(port, function() {
      log.info('Server listening on port ' + port)
    })
  })
  .catch(err => {
    log.error({ err }, 'Error building assets')
    process.exit(1)
  })
