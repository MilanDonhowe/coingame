// milan-coin
// let's show this decentralized bozos how to do monetary policy
const Koa = require('koa')
const crypto = require('crypto')

// DOM Purify for securing SSR
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// dependencies so koa is usable
const serve = require('koa-static');
const { bodyParser } = require("@koa/bodyparser");
const path = require('path')
const process = require('process')


// Database :)
const { db } = require("./db");

// initialize Koa application
const app = new Koa()

// keys for signing cookies (uses KeyGrip under the hood)
app.keys = [crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex')]
app.context.db = db
app.context.DOMPurify = DOMPurify

// prod middle-ware for fowarding /api routes
// this keeps the dev environment consistent with production
app.use(async (ctx, next) => {
  if (ctx.path.startsWith("/api")){
    ctx.path = ctx.path.split("/api")[1]
  }
  await next()
})

// authorized user middleware
app.use(async (ctx, next) => {
  // get user id cookie
  ctx.state.userID = ctx.cookies.get("user", { signed: true })
  await next()
})

const publicFiles = serve(path.join(__dirname, 'public'));

// Attach Dynamic API Routes
const userRouter = require('./routes/users')
const walletRouter = require('./routes/wallets')


//app.use(async ctx => {
//  console.log("[*] req from server:", ctx.path)
//})

app.use(bodyParser());

app.use(walletRouter.routes())
app.use(walletRouter.allowedMethods())
app.use(userRouter.routes())
app.use(userRouter.allowedMethods())


const PORT = 1337

process.on('SIGINT', () => {
  db.close()
  console.log("\n[*] SQLite3 DB closed.")
  process.exit()
})

// publicFiles._name = 'static /public';
//app.use(publicFiles)

app.use(async ctx => {
  if (ctx.path === "/top" && ctx.method === "GET"){
    const rows = await (new Promise((resolve, reject) => {
      // leader-board of top 100 gamers
      ctx.db.all(`select SUM(coins) as "net coins", username from wallets inner join users on wallets.owner_id = users.id group by wallets.owner_id order by "net coins" desc limit 100`, function(err, rows){
        if (err) reject(err)
        resolve(rows)
      })
    })).catch(err => {
      console.error(`[*] Error fetching leaderboard.\nError="${err}"`)
      ctx.throw(500)
    })
    const table = `
    <table class="customTable">
      <thead>
        <tr>
          <th>User</th>
          <th>Total Coins</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          ${rows.map( (x, idx) => `<td>#${idx+1}. ${x['username']}</td><td>${x['net coins']}</td>`).join("</tr><tr>")}
        </tr>
      </tbody>
    </table>`
    ctx.body = ctx.DOMPurify.sanitize(table)
  }
})

// then we would use ctx.cookies.get("user", {signed:true});

app.listen(PORT)
console.log("[*] koa.js server running on port", PORT)


