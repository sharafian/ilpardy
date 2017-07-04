const mustache = require('mustache')
const Payer = require('./payer')
const crypto = require('crypto')
const base64url = require('base64url')
const util = require('./util')
const uuid = require('uuid')

function makeId (str) {
  return base64url(crypto
    .createHash('sha256')
    .update(str)
    .digest())
}

module.exports = class Game {
  constructor (opts) {
    this.playerCount = opts.players
    this.playersJoined = 0
    this.playersGuessed = 0

    this.questions = require('../res/JEOPARDY_QUESTIONS1.json')
    this.templates = {
      join: util.load('../res/join.html'),
      wait: util.load('../res/wait.html'),
      play: util.load('../res/play.html')
    }

    this.nextQuestion()
    this.players = {}
    this.sockets = {}
  }

  setWsServer (wss) {
    wss.on('connection', (socket) => {
      const id = uuid()
      this.sockets[id] = socket

      socket.on('close', () => {
        delete this.sockets[id]      
      })
    })
  }

  broadcastWs () {
    Object.keys(this.sockets).map((id) => {
      const socket = this.sockets[id]
      try {
        socket.send('reload')
      } catch (e) {
        console.log('ws error:', e.message)
        delete this.sockets[id] 
      }
    })
  }

  nextQuestion () {
    let q = { value: '$0', answer: '' }
    while (q.value !== '$100' || q.answer.length > 10) {
      q = this.questions[Math.floor(Math.random() * this.questions.length)]
    }

    this.question = q.question
    this.answer = q.answer.toUpperCase()
    this.shuffle = util.shuffle(this.answer).map(a => ({ letter: a }))
    console.log('QUESTION', this.question, 'ANSWER', this.answer)
  }

  getJoinView (msg, color) {
    return mustache.render(this.templates.join, {
      message: msg || '',
      messageColor: color || 'rgba(0,0,0,0)'
    })
  }

  async getJoin (ctx) {
    console.log('GET /join')
    ctx.body = this.getJoinView()
  }

  async postJoin (ctx) {
    console.log('POST /join')

    if (this.playersJoined >= this.playerCount) {
      ctx.body = this.getJoinView('The game is already full', 'orange')
      return
    }

    const { nick, spsp, pass } = ctx.request.body
    const payer = new Payer({ spsp, pass })

    try {
      await payer.connect()
    } catch (e) {
      console.log('join error:', e.message)
      ctx.body = this.getJoinView('Failed to connect to ILP: ' + e.message, 'red')
      return
    }
  
    const playerId = makeId(nick + ':' + spsp + ':' + pass)
    this.players[playerId] = { payer, nick }
    this.playersJoined = Object.values(this.players).length

    ctx.redirect('/wait/' + playerId)
  }

  async getWait (ctx) {
    console.log('GET /wait')
    const { user } = ctx.params

    if (!this.players[user]) {
      ctx.redirect('/join')
      return
    }

    if (this.playersJoined === this.playerCount) {
      ctx.redirect('/play/' + user)
      return
    }

    ctx.body = mustache.render(this.templates.wait, {
      playersJoined: this.playersJoined,
      playerCount: this.playerCount,
      nick: this.players[user].nick
    })
  }

  getOpponents (user) {
    const nick = this.players[user].nick
    return Object.values(this.players)
      .filter(n => n.nick !== nick)
  }

  async getPlayView (user, message, messageColor) {
    const question = this.question
    const shuffle = this.shuffle
    const nick = this.players[user].nick
    const balance = await this.players[user].payer.getBalance()
    const balanceColor = (balance < 0) ? 'red' : 'green'
    const others = this.getOpponents(user)
      .map(o => ({ nick: o.nick }))

    return mustache.render(this.templates.play, {
      nick,
      others,
      shuffle,
      question,
      balance,
      balanceColor,
      message: message || '',
      messageColor: messageColor || 'rgba(0,0,0,0)'
    })
  }

  async getPlay (ctx) {
    console.log('GET /play')
    const { user } = ctx.params

    if (!this.players[user]) {
      ctx.statusCode = 404
      return
    }

    if (this.playersJoined !== this.playerCount) {
      ctx.redirect('/wait/' + user)
    }

    ctx.body = await this.getPlayView(user)
  }

  async postPlay (ctx) {
    console.log('POST /play')
    const { user } = ctx.params

    if (!this.players[user]) {
      ctx.statusCode = 404
      return
    }

    if (this.playersJoined !== this.playerCount) {
      ctx.redirect('/wait/' + user)
    }

    const { answer } = ctx.request.body

    if (this.players[user].played) {
      ctx.body = await this.getPlayView(user, 'You have already used your guess!', 'red')

    } else if (answer.toUpperCase() === this.answer) {
      await (this.rewardPlayer(user)
        .catch((e) => {
          console.log('Error giving reward:', e)
        }))

      await this.nextRound()
      ctx.body = await this.getPlayView(user, 'You won! Going to next round.', 'green')

    } else {
      this.players[user].played = true
      this.playersGuessed += 1

      if (this.playersGuessed === this.playerCount) {
        this.nextRound()
        ctx.body = await this.getPlayView(user, 'Wrong answer! Going to next round', 'orange')
      } else {
        ctx.body = await this.getPlayView(user, 'Wrong answer!', 'red')
      }
    }
  }

  async rewardPlayer (user) {
    console.log('rewarding', this.players[user].nick, '!')
    const receiver = this.players[user].payer.getSPSP()

    await Promise.all(this.getOpponents(user).map((other) => {
      console.log('pay 0.10 from', other.payer.getSPSP(), 'to', receiver)
      return other.payer.pay(receiver, '0.10')
        .catch((e) => {
          console.log('Error:', e)
        })
    }))
  }

  async nextRound () {
    this.nextQuestion()
    Object.values(this.players).map(v => v.played = false)
    this.playersGuessed = 0
    this.broadcastWs()
  }
}
