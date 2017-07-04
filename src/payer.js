const ILP = require('ilp')
const BigNumber = require('bignumber.js')
const PluginBells = require('ilp-plugin-bells')
const debug = require('debug')('ilpardy:payer')

module.exports = class Payer {
  constructor (opts) {
    this.spsp = opts.spsp
    this.pass = opts.pass
  }

  getSPSP () {
    return this.spsp
  }

  async connect () {
    // TODO: get this properly once plugin bells works
    const [ username, host ] = this.spsp.split('@')
    if (!username || !host) {
      throw new Error('"' + this.spsp + '" is not a valid SPSP ID')
    }

    const account = 'https://' + host + '/ledger/accounts/' + username

    this.plugin = new PluginBells({
      account: account,
      password: this.pass     
    })

    await this.plugin.connect()
    this.startBalance = +(await this.plugin.getBalance())
    this.scale = this.plugin.getInfo().currencyScale
  }

  async getBalance () {
    return new BigNumber(await this.plugin.getBalance())
      .sub(this.startBalance)
      .shift(-this.scale)
      .toFixed(3)
  }

  async pay (receiver, amount) {
    const payment = await ILP.SPSP.quote(this.plugin, {
      receiver,
      sourceAmount: amount
    })

    payment.memo = 'ILPardy winner!'

    await ILP.SPSP.sendPayment(this.plugin, payment)
    debug('sent', amount, 'from', this.spsp, 'to', receiver)
  }
}
