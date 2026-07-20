import mongoose from "mongoose";

export const connectDB = async () => {
    const uri = process.env.MONGODB_URL;

    // ── Guard: catch missing env var immediately ─────────────────────────────
    if (!uri) {
        console.error(
            "\n[MongoDB] ❌  MONGODB_URL is not set in backend/.env\n" +
            "   Copy the connection string from Atlas → Connect → Drivers\n"
        );
        process.exit(1);
    }

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,  // wait up to 15 s to find a server
            socketTimeoutMS: 45000,
            // tls is handled automatically by the connection string (ssl=true)
        });

        // console.log(
        //     `\n[MongoDB] ✅  Connected\n` +
        //     `   Host : ${conn.connection.host}\n` +
        //     `   DB   : ${conn.connection.name}\n`
        // );

    } catch (error) {
        console.error(`\n[MongoDB] ❌  Connection failed: ${error.message}\n`);

        // ── DNS / SRV lookup failure ─────────────────────────────────────────
        if (
            error.message.includes("querySrv") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ENOTFOUND") ||
            error.message.includes("getaddrinfo")
        ) {
            console.error(
                "  CAUSE: DNS cannot resolve the MongoDB Atlas hostname.\n" +
                "  This is usually caused by one of:\n" +
                "    1. Your internet connection is offline.\n" +
                "    2. A VPN, proxy, or corporate firewall blocks DNS SRV lookups.\n" +
                "    3. Your ISP's DNS server does not support SRV records.\n" +
                "\n" +
                "  FIXES TO TRY (in order):\n" +
                "    A) Disable any active VPN or proxy and retry.\n" +
                "    B) Switch DNS to Google (8.8.8.8) or Cloudflare (1.1.1.1):\n" +
                "         Windows: Network Settings → Adapter → IPv4 → DNS\n" +
                "    C) Use the direct seed-list connection string (no SRV):\n" +
                "         mongodb://user:pass@shard-00-00.host:27017,shard-00-01.host:27017,\n" +
                "                  shard-00-02.host:27017/DB?ssl=true&replicaSet=...\n" +
                "         (Get this from Atlas → Connect → Shell → 'I have mongo installed')\n" +
                "    D) Whitelist your IP in Atlas: Network Access → Add IP → 0.0.0.0/0\n"
            );
        }

        // ── Authentication failure ────────────────────────────────────────────
        if (
            error.message.includes("Authentication failed") ||
            error.message.includes("bad auth") ||
            error.message.includes("SCRAM") ||
            error.message.includes("AuthenticationFailed")
        ) {
            console.error(
                "  CAUSE: Atlas rejected the username or password.\n" +
                "  FIXES:\n" +
                "    A) Atlas → Database Access → check the username and password.\n" +
                "    B) If the password contains @, %, &, ?, / — URL-encode them.\n" +
                "         Example: p@ss → p%40ss\n"
            );
        }

        // ── IP not whitelisted ────────────────────────────────────────────────
        if (
            error.message.includes("whitelist") ||
            error.message.includes("IP") ||
            error.message.includes("not allowed")
        ) {
            console.error(
                "  CAUSE: Your IP address is not whitelisted on Atlas.\n" +
                "  FIX: Atlas Dashboard → Network Access → Add IP Address → 0.0.0.0/0\n"
            );
        }

        process.exit(1);
    }
};
