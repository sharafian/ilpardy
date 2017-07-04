# ILPardy
> A trivia game using ILP for micropayments

## Setup

Before you play the game at all, you have to install the question set.
It's too big to include in the repo, but you can fetch it with:

```
bash ./scripts/download_questions.sh
```

Then you can start the server with:

```
npm install
npm start
```

Environment variables can be set to determine the number of players and the
port that the server runs on. Debug output can also be set with the `debug`
module.

```
DEBUG=ilp* ILPARDY_PORT=8090 ILPARDY_PLAYERS=5 npm start
```

## Playing the Game

Go to `localhost:8080` (or the other port you chose). It will direct you to a
login page.  Enter the nickname you'll use in the game, and the SPSP address
you want to use to send and receive ILP payments. For example, you might use
`user@ilp.example`. Your password should be the password to the ledger account.

If the account is connected successfully, you'll be sent to a waiting screen.
Once the other players join, you'll be dropped into the game. Every time
someone gets a correct answer, the other players send them 10 cents. You only
get one guess at the question, but if everyone gets it wrong then the question
resets.
