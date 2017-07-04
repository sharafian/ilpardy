const ILP = require('ilp')
const PluginBells = require('ilp-plugin-bells')

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
  }

  async pay (receiver, amount) {
    const payment = await ILP.SPSP.quote(this.plugin, {
      receiver,
      sourceAmount: amount
    })

    payment.memo = 'ILPardy winner!'

    await ILP.SPSP.sendPayment(this.plugin, payment)
    console.log('sent', amount, 'from', this.spsp, 'to', receiver)
  }
}
