const ILP = require('ilp')
const PluginBells = require('ilp-plugin-bells')

module.exports = class Payer {
  constructor (opts) {
    this.spsp = opts.spsp

    // TODO: get this properly once plugin bells works
    const [ username, host ] = opts.spsp.split('@')
    const account = 'https://' + host + '/ledger/accounts/' + username

    this.plugin = new PluginBells({
      account: account,
      password: opts.pass     
    })
  }

  getSPSP () {
    return this.spsp
  }

  async connect () {
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
