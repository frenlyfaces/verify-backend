import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
// tslint:disable-next-line: no-submodule-imports
import { Routes } from "discord-api-types/v9";
import { loadEnv } from "../utils/loadEnv";

loadEnv();

const commands = [
    new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Verifies your NFT holder status"),
].map((command) => command.toJSON());

const rest = new REST({ version: "9" }).setToken(process.env.DISCORD_TOKEN!);

rest.put(
    Routes.applicationGuildCommands(
        process.env.CLIENT_ID!,
        process.env.GUILD_ID!
    ),
    { body: commands }
)
    .then(() => console.log("Successfully registered application commands."))
    .catch(console.error);
