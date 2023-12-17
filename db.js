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

module.exports = {
    db
}