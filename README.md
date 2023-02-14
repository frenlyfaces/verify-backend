# canto-verification-backend

A quick start repo for typescript projects.

Contains these tools:

1. Prettier for code formatting
2. TSLint for linting
3. Husky & lint-staged for pre-commit hooks (currently foirmats and then lints the code pre-commit)

All of your typescript files should go in the `./src` directory, and the compiled javscript will be available at `./dist`.

## Setup

-   Create the required .env file at the root:

```
DISCORD_TOKEN={insert discord token here}
GUILD_ID={guild id here}
CLIENT_ID={discord bot id here}
ROLE_ID={verified role here}
REMOVE_ROLE_ID={unverified role here}
VERIFY_URL={custom domain here}/verify
```

-   Install the dependencies

`npm i`

-   Start the project. Typescript will be compiled automatically.

`npm start`

You can now lint your project with `yarn lint` or `yarn lint-fix`
