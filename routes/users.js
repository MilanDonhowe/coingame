/*
    Filename: users.js
    Author: Milan Donhowe
    Info: Users routes
*/

const bcrypt = require("bcrypt")
const Router = require('@koa/router')
const router = new Router({ prefix: '/users' })

// TODO: make this a dynamic value from a settings file
const COST_FACTOR = 3

// create new user
router.post("/register", async (ctx, next) => {
    const password = ctx.request.body?.password
    const username = ctx.request.body?.username?.toUpperCase() // username should be case insensitive
    if (!( (typeof(password) === typeof(username)) &&  (typeof(username) === typeof("")) )){
        ctx.throw(400, "invalid account information")
    }

    console.log("[*] request for registering user: ", ctx.request.body)
    const salt = await bcrypt.genSalt(COST_FACTOR)
    const hash = await bcrypt.hash(password, salt)

    // create user in db
    const userID = await (new Promise((resolve, reject) => {
        ctx.db.run("INSERT INTO users (username, password, salt) VALUES (?, ?, ?)", [username, hash, salt], function (err) {
            if (err) reject(err)
            resolve(this.lastID) // <-- id of created user entity
        })
    })).catch(err => {
        // SQLite3 Constraint Error:
        if (err.errno === 19){
            // TODO: implement HTML error page
            ctx.throw(400, "User with that username already exists")
            return
        }
        // otherwise, unknown error
        console.error(`[*] Error creating user in SQLite: ${err}`)
        ctx.throw(500)
    })

    // create default wallet
    const walletID = await (new Promise((resolve, reject) => {
        ctx.db.run("INSERT INTO wallets (coins, owner_id) VALUES (?,?)", [10, userID], function(err){
            if (err) reject(err)
            resolve(this.lastID)
        })
    })).catch(err => {
        console.log(`[*] Error creating default wallet in SQLite: ${err}`)
    })

    await (new Promise((resolve, reject) => {
        ctx.db.run("UPDATE users SET default_wallet_id = ? WHERE id = ?", [walletID, userID], function(err){
            if (err) reject(err)
            resolve(this.lastID)
        })
    })).catch(err => {
        console.log(`[*] Error linking default wallet w/ user in SQLite: ${err}`)
    })

    // set user as logged in
    ctx.cookies.set('user', userID, { signed: true });
    ctx.redirect("/status.html")
})

// user logout
router.get("/logout", async (ctx, next) => {
    ctx.cookies.set("user", "") // delete cookie by setting to empty string
    ctx.state.userID = null // set state userid to null (just in case)
    ctx.redirect("/index.html")
})

// handle prompt for login/logout
router.get("/loginPrompt", async (ctx, next) => {
    if (ctx.state.userID){
        ctx.body = `<a href="/api/users/logout">Logout</a>`
        return
    } else {
        ctx.body = `<a href="/login">Login</a>`
    }
})
router.get("/registerPrompt", async (ctx, next) => {
    if (ctx.state.userID){
        ctx.body = ``
        return
    } else {
        // TODO: figure out how to not put tailwind css in these freaking routes
        ctx.body = `<div class="bg-slate-400 text-white hover:text-black text-center w-52 float-right border-2 font-bold border-black"><a href="/register">Register</a></div>`
    }
})

router.post('/login', async (ctx, next) => {

    const password = ctx.request.body?.password
    const username = ctx.request.body?.username?.toUpperCase()

    if (!( (typeof(password) === typeof(username)) && (typeof(username) === typeof("")) )){
        ctx.throw(400, "invalid account information")
    }

    console.log("[*] request for login: ", ctx.request.body)

    // get user data
    const user = await (new Promise((resolve, reject) => {
        ctx.db.get("SELECT id, password, salt FROM users WHERE username = ?", [username], (err, row) => {
            if (err){
                reject(err)
                return
            }
            resolve(row)
        })
    })).catch((err) => {
        console.error(`[*] Error with looking up user: "${user}"`)
        ctx.throw(500)
    })

    if (user === undefined){
        //ctx.throw(404, `User with username="${username}" not found.`)
        ctx.redirect("/login.html?wrongUsername=1")
        return
    }

    console.log("[*] user:", JSON.stringify(user))
    const hash = await bcrypt.hash(password, user.salt)
    if (hash === user.password){
        // user is authenticated
        ctx.cookies.set("user", user.id.toString(), { signed: true })
        // redirect to home-page, user-data will populate now with the cookie.
        ctx.redirect("/home")
    } else {
        ctx.redirect("/login.html?wrongPassword=1")
        //ctx.throw(400, "Wrong Password")
    }
})

router.get("/info", async (ctx, next) => {
    const userID = ctx.cookies.get("user", { signed: true })
    if (userID){
      const user = await (new Promise((resolve, reject) => {
        ctx.db.get("SELECT u.id, u.username, w.coins FROM users u JOIN wallets w ON u.default_wallet_id = w.id WHERE u.id = ?", [userID], (err, row) => {
            if (err) reject(err)
            resolve(row)
        })
      }))
      
      // DOMPurify to prevent XSS
      ctx.body = ctx.DOMPurify.sanitize(`
      <div>
        <ol>
          <li>User ID: ${user.id}</li>
          <li>Username: ${user.username}</li>
          <li>Coins: ${user.coins}</li>
        </ol>
      </div>
      `)
    } else {
      ctx.body = `
      <div>
        <h3>User not logged in.</h3>
      </div>`
    }
})

router.get("/wallets", async (ctx, next) => {
    const userID = ctx.cookies.get("user", { signed: true })
    if (userID){
        const wallets = await (new Promise((resolve, reject) => {
            ctx.db.all("SELECT * FROM wallets WHERE owner_id = ?", [userID], (err, rows) => {
                if (err) reject(err)
                resolve(rows)
            })
        })).catch(err => {
            console.error(`[*] Error retrieving wallets for user id=${userID}.\nError="${err}"`)
            ctx.throw(500, "could not find user wallets")
        })
        console.log(wallets)
        ctx.body = "found wallets"
    } else {
        ctx.throw(403, "User not logged in.")
    }
})


module.exports = router