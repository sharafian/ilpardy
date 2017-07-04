const mustache = require('mustache')
const fs = require('fs')
const path = require('path')
const Payer = require('./payer')
const crypto = require('crypto')
const base64url = require('base64url')

function load (file) {
  return fs.readFileSync(path.resolve(__dirname, file))
    .toString('utf8')
}

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
      join: load('../res/join.html'),
      wait: load('../res/wait.html'),
      play: load('../res/play.html')
    }

    this.nextQuestion()
    this.players = {}
  }

  nextQuestion () {
    const q = this.questions[Math.floor(Math.random() * this.questions.length)]

    this.question = q.question
    this.answer = q.answer
    console.log('QUESTION', this.question, 'ANSWER', this.answer)
  }

  async getJoin (ctx) {
    console.log('GET /join')
    ctx.body = mustache.render(this.templates.join, {})
  }

  async postJoin (ctx) {
    console.log('POST /join')
    const { nick, spsp, pass } = ctx.request.body
    const payer = new Payer({ spsp, pass })

    try {
      await payer.connect()
    } catch (e) {
      console.log('join error:', e.message)
      ctx.redirect('/join')
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

  getPlayView (user, message, messageColor) {
    const question = this.question
    const nick = this.players[user].nick
    const others = Object.values(this.players)
      .map(v => ({ nick: v.nick }))
      .filter(n => n.nick !== nick)

    return mustache.render(this.templates.play, {
      nick,
      others,
      question,
      message: message || '',
      messageColor: messageColor || 'black'
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

    ctx.body = this.getPlayView(user)
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
      ctx.body = this.getPlayView(user, 'You have already used your guess!', 'red')

    } else if (answer === this.answer) {
      this.rewardPlayer(user)
      await this.nextRound()
      ctx.body = this.getPlayView(user, 'You won! Going to next round.', 'green')

    } else {
      this.players[user].played = true
      this.playersGuessed += 1

      if (this.playersGuessed === this.playerCount) {
        this.nextRound()
        ctx.body = this.getPlayView(user, 'Wrong answer! Going to next round', 'yellow')
      } else {
        ctx.body = this.getPlayView(user, 'Wrong answer!', 'red')
      }
    }
  }

  async rewardPlayer (user) {
    console.log('rewarding', this.players[user].nick, '!')
  }

  async nextRound () {
    this.nextQuestion()
    Object.values(this.players).map(v => v.played = false)
    this.playersGuessed = 0
  }
}
