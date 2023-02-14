import log from "electron-log";
import { loadEnv } from "./utils/loadEnv";
import axios from "axios";
import { Client as DiscordClient, Intents } from "discord.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import { createConnection, getRepository } from "typeorm";
import path from "path";
import { Holder } from "./entities/Holder";
import * as uuid from "uuid";
import { ethers } from "ethers";
import { VerifyPayload } from "./types/api";
import { DiscordUser } from "./types/discord";
import { nftContract } from "./constants/eth";

// load the environment variables
loadEnv();

const whitelistedNoToken = ["626681739778981898"];

async function main() {
    const tokenMap = new Map<string, string>();

    /* initiate discord and solana connections */
    const discord = new DiscordClient({
        intents: [Intents.FLAGS.GUILDS, "GUILD_MEMBERS"],
    });

    /* initiate db */
    await createConnection({
        type: "sqlite",
        database: "db.sqlite",
        entities: [path.resolve(__dirname, "entities/*{.ts,.js}")],
        synchronize: true,
    });

    /* initiate api and middleware */
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(morgan("dev"));
    app.use(helmet());

    app.post("/token", async (req, res) => {
        const { address } = req.body as { address: string | undefined };

        // check address validity
        if (!address) {
            res.sendStatus(400);
            return;
        }

        const tokenToSign = uuid.v4();
        tokenMap.set(address, tokenToSign);

        setTimeout(() => {
            tokenMap.delete(address);
        }, 60000);

        res.json({
            token: `You are signing this message to authenticate yourself as a ${process
                .env
                .PROJECT_NAME!} holder to access Discord. Please ensure you are only signing this message on ${
                process.env.VERIFY_URL
            } ${tokenToSign}`,
        });
    });

    app.post("/verify", async (req, res) => {
        try {
            const body: VerifyPayload = req.body;

            const { message, signature, discordToken } = body;

            /* ensure discord ID matches with token provided */
            const discordRes = await axios.get(
                "https://discord.com/api/users/@me",
                {
                    headers: {
                        authorization: `Bearer ${discordToken}`,
                    },
                }
            );

            const userInfo: DiscordUser = discordRes.data;

            /* fetch guild and verified role */
            const guild = await discord.guilds.fetch(process.env.GUILD_ID!);
            const verifiedRole = await guild.roles.fetch(
                process.env.VERIFIED_ROLE_ID!
            );
            const member = await guild.members.fetch(userInfo.id);

            if (!verifiedRole) {
                res.sendStatus(500);
                return;
            }

            let verifiedAddress: string | null = null;

            try {
                const result = ethers.verifyMessage(message, signature);
                verifiedAddress = result;
            } catch (err) {
                log.info(err);
                res.sendStatus(401);
                return;
            }

            if (!verifiedAddress) {
                res.sendStatus(500);
                return;
            }

            const frenlyBalance = Number(
                await nftContract.balanceOf(verifiedAddress)
            );

            const signedToken = message.split(" ").pop();

            // ensure the correct token is signed
            if (tokenMap.get(verifiedAddress) !== signedToken) {
                res.sendStatus(401);
                return;
            }

            if (frenlyBalance < 1) {
                res.sendStatus(401);
                return;
            }

            /* save address details to db */
            const holder = new Holder();
            holder.address = verifiedAddress;
            holder.discordId = userInfo.id;
            holder.balance = frenlyBalance;

            try {
                await getRepository(Holder).save(holder);
            } catch (err) {
                log.error(err);
                res.sendStatus(500);
            }

            await member.roles.add(verifiedRole);

            res.sendStatus(200);
        } catch (err) {
            log.error(err);
            res.sendStatus(401);
        }
    });

    const verifyHolders = async () => {
        log.info("Checking for non-holders with verified role");
        const holders = await getRepository(Holder).find();

        /* fetch guild and verified verifiedRole */
        const guild = await discord.guilds.fetch(process.env.GUILD_ID!);
        const verifiedRole = await guild.roles.fetch(
            process.env.VERIFIED_ROLE_ID!
        );
        let deleted = 0;

        await guild.members.fetch();

        for (const holder of holders) {
            if (whitelistedNoToken.includes(holder.discordId)) {
                continue;
            }

            const frenlyBalance = Number(
                await nftContract.balanceOf(holder.address)
            );

            if (frenlyBalance < 1) {
                log.info("Paper hands sold, yeeting " + holder.address);

                const guildUsers = guild.members.cache.map((data) => data.id);

                if (guildUsers.includes(holder.discordId)) {
                    if (!verifiedRole) {
                        log.error("Role not found");
                        continue;
                    }

                    try {
                        const member = await guild.members.fetch(
                            holder.discordId
                        );
                        await member.fetch();
                        await member.roles.remove(verifiedRole);
                    } catch (err) {
                        log.warn("error with role management");
                        log.warn(err);
                        return;
                    }
                } else {
                    log.info("User has already left discord");
                }

                try {
                    const dbEntry = await getRepository(Holder).findOne({
                        discordId: holder.discordId,
                    });
                    if (!dbEntry) {
                        continue;
                    }

                    await getRepository(Holder).delete(dbEntry);
                    deleted++;
                } catch (err) {
                    log.warn("error with db mutation");
                    log.warn(err);
                    return;
                }
            }
        }

        log.info(
            "Non-holder check complete. " + deleted + " holders unverified."
        );
    };

    setTimeout(verifyHolders, 1000 * 60 * 3);

    discord.once("ready", () => {
        log.info("Discord client logged in.");
        verifyHolders();
    });

    // listen!
    discord.login(process.env.DISCORD_TOKEN!);
    app.listen(Number(process.env.PORT!), () => {
        log.info(`Express API started on port ${process.env.PORT!}`);
    });
}

main();
