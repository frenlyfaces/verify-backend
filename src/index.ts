import log from "electron-log";
import { loadEnv } from "./utils/loadEnv";
import axios from "axios";
import {
    Client as DiscordClient,
    Intents,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
} from "discord.js";
import {
    Connection,
    Connection as SolanaConnection,
    PublicKey,
} from "@solana/web3.js";
import express from "express";
import cors from "cors";
import { sign } from "tweetnacl";
import { decode } from "@stablelib/base64";
import morgan from "morgan";
import helmet from "helmet";
import { mintList } from "./constants/mintList";
import {
    createConnection,
    Connection as DBConnection,
    getRepository,
} from "typeorm";
import path from "path";
import { Holder } from "./entities/Holder";
import * as uuid from "uuid";
import { Contract, ethers } from "ethers";
import { JsonRpcProvider } from "ethers";

// load the environment variables
loadEnv();

const provider = new JsonRpcProvider(`https://canto.slingshot.finance`, 7700);
const FRENLY_CONTRACT_ADDRESS = "0x020bbfC79C96c22A8677df740379ecCc0297E52C";

const frenlys = new ethers.Contract(
    FRENLY_CONTRACT_ADDRESS,
    ["function balanceOf(address) external view returns (uint256)"],
    provider
);

const minABI = [
    // balanceOf
    {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
    },
];

interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
    verified: boolean;
    email: string;
    flags: number;
    banner: string;
    accent_color: number;
    premium_type: number;
    public_flags: number;
}

export interface VerifyPayload {
    message: string;
    signature: string;
    discordToken: string;
    discordTokenType: string;
}

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
            token: `You are signing this message to authenticate yourself as a Frenly Faces holder to access Discord. Please ensure you are only signing this message on https://frenlyfaces.xyz ${address} ${tokenToSign}`,
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
            const role = await guild.roles.fetch(process.env.ROLE_ID!);
            const deleteRole = await guild.roles.fetch(
                process.env.REMOVE_ROLE_ID!
            );
            const member = await guild.members.fetch(userInfo.id);

            if (!role || !deleteRole) {
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
                await frenlys.balanceOf(verifiedAddress)
            );
            const signedToken = message.split(" ").pop();
            console.log();

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

            await member.roles.add(role);
            await member.roles.remove(deleteRole);

            res.sendStatus(200);
        } catch (err) {
            log.error(err);
            res.sendStatus(401);
        }
    });

    const verifyCultMembership = async () => {
        log.info("Checking for non-holders with verified role");
        const holders = await getRepository(Holder).find();

        /* fetch guild and verified role */
        const guild = await discord.guilds.fetch(process.env.GUILD_ID!);
        const role = await guild.roles.fetch(process.env.ROLE_ID!);
        const deleteRole = await guild.roles.fetch(process.env.REMOVE_ROLE_ID!);
        let deleted = 0;

        for (const holder of holders) {
            const frenlyBalance = Number(
                await frenlys.balanceOf(holder.address)
            );

            if (frenlyBalance < 1) {
                log.info("Paper hands sold, yeeting " + holder.address);

                const guild = await discord.guilds.fetch(process.env.GUILD_ID!);

                if (!role || !deleteRole) {
                    log.error("Role not found");
                    continue;
                }

                const member = await guild.members.fetch(holder.discordId);
                await member.roles.remove(role);
                await member.roles.add(deleteRole);

                const dbEntry = await getRepository(Holder).findOne(
                    holder.discordId
                );
                if (!dbEntry) {
                    continue;
                }
                await getRepository(Holder).delete(dbEntry);
                deleted++;
            }
        }

        log.info("Non-holder check complete. " + deleted + " holders removed.");
    };

    const purgeNonBelievers = async () => {
        /* fetch guild and verified role */
        try {
            log.info("Purging non believers...");
            const guild = await discord.guilds.fetch(process.env.GUILD_ID!);
            const role = await guild.roles.fetch(process.env.ROLE_ID!);
            const deleteRole = await guild.roles.fetch(
                process.env.REMOVE_ROLE_ID!
            );

            await guild.members.fetch();

            if (!role || !deleteRole) {
                log.warn(
                    "programmer error in purge non believers, no roles found"
                );
                return;
            }

            let purged = 0;

            for (const member of deleteRole.members) {
                const [discordID, guildMember] = member;

                if (guildMember.joinedAt) {
                    // if they haven't verified for ten minutes, remove them forcibly
                    if (
                        Date.now() - new Date(guildMember.joinedAt).getTime() >
                        1000 * 60 * 10
                    ) {
                        guildMember.kick();
                        purged++;
                    }
                }
            }

            log.info("Purged " + purged + " nonbelievers");
        } catch (err) {
            log.warn(err);
        }
    };

    // every 10m, purge the unholy
    setTimeout(verifyCultMembership, 1000 * 60 * 10);
    setTimeout(purgeNonBelievers, 1000 * 60 * 10);

    /* discord command handlers */
    discord.once("ready", () => {
        log.info("Discord client logged in.");
        verifyCultMembership();
        purgeNonBelievers();
    });

    discord.login(process.env.DISCORD_TOKEN!);

    app.listen(5353, () => {
        log.info("Express API started on port 5353");
    });
}

main();
