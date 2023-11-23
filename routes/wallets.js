/*
    Filename: wallets.js
    Author: Milan Donhowe
    Info: Wallet routes
*/

const Router = require('@koa/router')
const router = new Router({ prefix: '/wallets' })

// TODO: make this dynamically configurable
const DEFAULT_WALLET_AMOUNT = 10;

router.post("/create", async (ctx, next) => {
    // need userID
    const userID = ctx.cookies.get("user", { signed: true })
    if (userID){
        // create wallet
        const wallet_id = await (new Promise ((resolve, reject) => {
            ctx.db.run("INSERT INTO wallets (coins, owner_id) VALUES (?, ?)", [DEFAULT_WALLET_AMOUNT, userID], function (err) {
                if (err){
                    reject(err)
                    return
                }
                resolve(this.lastID)
            })
        }))
        ctx.body = "Successfully created wallet with id # of " + wallet_id.toString()
    } else {
        ctx.throw(400, "Please login to create a wallet.")
    }
})

router.get("/transfer", async (ctx, next) => {
    if (ctx.state.userID){
        // TODO: allow for user to select specific wallet to transfer funds from
        const wallet = await (new Promise ((resolve, reject) => {
            ctx.db.get("SELECT * FROM wallets WHERE owner_id = ?", [ctx.state.userID], function(err,row){
                if (err){
                    reject(err)
                    return
                }
                resolve(row)
            })
        })).catch(err => {
            ctx.throw(500, "<div>Internal Server Error :(</div>")
        })
        ctx.body = ctx.DOMPurify.sanitize(`
            <form action="/api/wallets/transfer" method="POST" enctype="application/x-www-form-urlencoded">
                <label for="recepient">Recepient</label>
                <input type="text" name="recepient" required>
                <label for="amount">Amount</label>
                <input type="number" min="1" max="${wallet.coins}" name="amount" required>
                <input type="submit" value="Transfer">
            </form>
        `)
    } else {
      //ctx.redirect("/login")
      ctx.body = `<div>Please login to transfer funds.</div>` 
    }
})

// this one is for all the marbles
// I wanted this method verb to be "PUT" but HTML form elements only allow POST/GET/DIALOG...
router.post("/transfer", async (ctx, next) => {
    // get & validate format data
    console.log("[*] Request to transfer funds:", ctx.request.body)

    const amount = ctx.request.body?.amount
    const recepient = ctx.request.body?.recepient?.toUpperCase()

    const coins = parseInt(amount, 10)


    // verify the form types
    if (!( (typeof(recepient) === 'string') && (isNaN(amount) === false) )){
        ctx.throw(400, "invalid form data")
    }

    // ensure we don't mess around w/ non-positive transfer amounts
    if (coins <= 0){
        ctx.throw(400, "invalid transfer amount (must be >0)")
    }

    if (ctx.state.userID){
        await new Promise( async (resolve, reject) => {
            // make sure from_wallet has the funds

            // have to do this hack w/ a boolean flag since 
            // the reject() doesn't actually halt execution...
            let getWalletFail = false;

            // get sender wallet (default wallet) by id
            const sender_wallet = await (new Promise((resolve, reject) => {
                ctx.db.get("SELECT default_wallet_id FROM users WHERE id = ?", [ctx.state.userID], function (err, row){
                    if (err) reject(err)
                    if (!row?.default_wallet_id){
                        reject("user does not have default wallet set")
                        return
                    }
                    resolve(row.default_wallet_id)
                })
            })).catch((err) => {
                console.log(`[*] error getting sender wallet: "${err}"`)
                reject(err)    
                getWalletFail = true  
            })

            if (getWalletFail) return

            // get recepient wallet by username
            const recepient_wallet = await (new Promise((resolve, reject) => {
                ctx.db.get("SELECT default_wallet_id FROM users WHERE username = ?", [recepient], function (err, row){
                    if (err) reject(err)
                    if (!row?.default_wallet_id){
                        reject("user does not have default wallet set")
                        return
                    }
                    resolve(row.default_wallet_id)
                })
            })).catch((err) => {
                console.log(`[*] error getting recepient wallet: "${err}"`)
                reject(err)    
                getWalletFail = true  
            })

            if (getWalletFail) return;
            
            console.log(`[*] got recepient wallet id=${recepient_wallet}`)
            console.log(`[*] trying to transfer ${coins} coins from wallet ${sender_wallet} to wallet ${recepient_wallet}`)
            // add & subtract funds atomically (no double-spend!!!!!)
            ctx.db.run("UPDATE OR FAIL wallets SET coins = (CASE WHEN id = ? THEN coins + ? WHEN id = ? THEN coins - ? END) WHERE id IN (?, ?) AND (SELECT coins FROM wallets WHERE id = ?) >= ?",
                [recepient_wallet, coins, sender_wallet, coins, recepient_wallet, sender_wallet, sender_wallet, coins], function (res, err) {
                    console.log("test:", this.lastID, res)
                    if (err || this.lastID === undefined){
                        reject (err || "unknown sql error (lastID = 0)")
                        return
                    }
                    resolve("success")
            })
        }).catch(err => {
            console.error(`[*] failed to transfer ${coins} coins from wallet #${sender_wallet} to wallet #${recepient}.\nError="${err}"`)
            ctx.throw(500) // can't set custom messages with error code 500 by default...
        })
        ctx.body = ctx.DOMPurify.sanitize(`
        <html>
            <body>
            <h1>Success!</h1>
            <p>Successfully transfered ${coins} coins to user "${recepient}"</p>
            <br>
            <a href="/status">Continue playing coin game</a>
            </body>
        </html>
        `)
    } else {
        ctx.throw(400, "Please login to transfer funds")
    }
})

module.exports = router