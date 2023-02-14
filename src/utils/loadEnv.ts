import { config } from "dotenv";

/* 
  Populate process.env with vars from .env and verify required vars are present. 
  Thanks Z for this function.
*/
export function loadEnv(): void {
    config();
    const requiredEnvVars: string[] = [
        "DISCORD_TOKEN",
        "GUILD_ID",
        "CLIENT_ID",
        "VERIFIED_ROLE_ID",
        "VERIFY_URL",
        "RPC_URI",
        "CONTRACT_ADDRESS",
    ];
    for (const required of requiredEnvVars) {
        if (process.env[required] === undefined) {
            console.warn(
                `Required environment variable '${required}' is not set. Please consult the README.`
            );
            process.exit(1);
        }
    }
}
