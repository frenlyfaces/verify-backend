# canto-verification-backend

this repository contains the Express API / Discord bot code for Frenly Face's NFT Verification bot. You'll need to set this API up as well as the serve the [frontend](https://github.com/frenlyfaces/verify-frontend).

## Setup

### discord setup

-   Go to your applications on [Discord Developer Portal](https://discord.com/developers/applications). Create a new application, then create a bot for that application. Copy and save the provided secret token somewhere safe.

-   Create a role within the Discord application for your verified holders, then copy the ID of that role. (You can easily copy IDs of anything with a right click by enabling Developer Mode in Discord settings.) You will use that role as VERIFIED_ROLE_ID in the .env file

-   Create a private channel and configure the permissions so that holders of your new Verified role may view the channel

### deploying the API

-   Create the required .env file at the root:

```
DISCORD_TOKEN={Discord secret token here}
GUILD_ID={Your discord server ID}
CLIENT_ID={Your discord bot user ID}
VERIFIED_ROLE_ID={your verified role ID}
VERIFY_URL={your verification frontend URI}
RPC_URI={a canto RPC URI}
CONTRACT_ADDRESS={Your NFT contract address}
PROJECT_NAME={Your Project Name}
```

-   Install the dependencies

`npm i`

-   Start the project. Typescript will be compiled automatically.

`npm start`

You can now lint your project with `yarn lint` or `yarn lint-fix`. the express API will start on port 5353.

### deploying the frontend

Once you've got the API running, you also need to deploy the [frontend](https://github.com/frenlyfaces/verify-frontend).

### serving

I recommend serving this API through a reverse proxy utilizing NGINX. you can use a configuration like this:

```
server {
        root /var/www/api.frenlyfaces.xyz;
        index index.html index.htm index.nginx-debian.html;

        server_name api.frenlyfaces.xyz;

        location / {
                proxy_pass http://localhost:5353/;
        }
}

```
