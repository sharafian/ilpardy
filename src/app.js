const Koa = require('koa')
const Router = require('koa-router')
const Parser = require('koa-bodyparser')
const Game = require('./game')
const util = require('./util')
const ws = require('ws')

const app = new Koa()
const router = Router()
const parser = Parser()

const game = new Game({
  players: +process.env.ILPARDY_PLAYERS || 2
})

// redirect to join
router.get('/', ctx => {
  ctx.redirect('/join')
})

// style
const style = util.load('../res/style.css')
router.get('/style.css', ctx => {
  ctx.body = style
})

// register players for the game
router.get('/join', game.getJoin.bind(game))
router.post('/join', game.postJoin.bind(game))

// wait for the players to join
router.get('/wait/:user', game.getWait.bind(game))

// start the actual game
router.get('/play/:user', game.getPlay.bind(game))
router.post('/play/:user', game.postPlay.bind(game))

const server = app
  .use(parser)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(process.env.ILPARDY_PORT || 8080)

const wss = new ws.Server({
  perMessageDeflate: false,
  server: server
})

game.setWsServer(wss)
