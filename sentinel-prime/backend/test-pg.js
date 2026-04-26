const { Client } = require("pg");

const client = new Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "postgres",
    database: "postgres",
});

client.connect()
    .then(() => {
        console.log("✅ Connected to PostgreSQL!");
        return client.query("SELECT NOW() as time");
    })
    .then((result) => {
        console.log("Server time:", result.rows[0].time);
        client.end();
    })
    .catch((err) => {
        console.error("❌ Error:", err.message);
        client.end();
    });
