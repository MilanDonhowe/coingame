/*
    Filename: db.js
    Author: Milan Donhowe
    Info: db logic
*/

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('coin.db')
const bcrypt = require('bcrypt')

// aka "salt-rounds" used in the bcrypt alg
const COST_FACTOR = 3; // set small for now
const DEFAULT_START_COINS = 10;

db.serialize(() => {
    console.log("[*] Initializing SQLite DB...")

    // create "users" table

    // v1: email is null for now
    db.run(`
    CREATE TABLE IF NOT EXISTS "users" (
        "id"	INTEGER NOT NULL UNIQUE,
        "default_wallet_id"	INTEGER UNIQUE,
        "username"	TEXT NOT NULL UNIQUE,
        "email"	TEXT UNIQUE,
        "password"	TEXT NOT NULL,
        "salt" TEXT NOT NULL,
        PRIMARY KEY("id" AUTOINCREMENT)
    );`)

    // create "wallet table"
    db.run(`
    CREATE TABLE IF NOT EXISTS "wallets" (
        "id"	INTEGER NOT NULL,
        "coins"	INTEGER NOT NULL,
        "owner_id"	INTEGER NOT NULL,
        PRIMARY KEY("id" AUTOINCREMENT)
    );`)

    // create transactions table
    // this is purely for accounting purposes
    db.run(`
    CREATE TABLE IF NOT EXISTS "transactions" (
        "sender_wallet_id" INTEGER NOT NULL,
        "recepient_wallet_id"  INTEGER NOT NULL,
        "coins" INTEGER NOT NULL,
        "time" INTEGER NOT NULL
    );`)

    // TO-DO: maybe create another data-store for session storage
    console.log("[*] DONE BUILDING DB")
});

function createWallet(owner_id){
    return new Promise(async (resolve, reject) => {
        if (typeof(owner_id) !== typeof(0)){
            reject(`Attempted to create a new wallet with a non-numeric owner_id="${owner_id}"`)
        }

        const stmt = db.prepare("INSERT INTO wallets (owner_id, coins) VALUES (?, ?)")
        stmt.run(owner_id, DEFAULT_START_COINS)
        stmt.finalize((err) => {
            if (err) reject(err)
            // get most recently created wallet id
            // this is a dumb way of doing this in the event we have a user generate two wallets concurrently
            db.get("SELECT id FROM wallets WHERE owner_id = ? ORDER BY id DESC LIMIT 1", [owner_id], (err, row) => {
                if (err) reject(err)
                // return wallet id on successful creation
                console.log(row)
                resolve(row.id)
            })
        })
    })
    
}

function createUser(username, password){
    return new Promise(async (resolve, reject) => {
        // hash the password w/bcrypt
        const salt = await bcrypt.genSalt(COST_FACTOR)
        const hash = await bcrypt.hash(password, salt)
        // save to DB
        const stmt = db.prepare("INSERT INTO users (username, password, salt) VALUES (?, ?, ?)")
        stmt.run(username, hash, salt)
        stmt.finalize((err) => {
            if (err) {
                reject(err)
            }
            db.get("SELECT id FROM users where username = ?", [username], (err, row) => {
                console.log(err, row)
                if (err){
                    reject(err)
                }
                // return user id on successful creation
                resolve(row.id)
            })
        })
    })
}

module.exports = {
    db
}