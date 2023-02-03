# typescript-boilerplate

A quick start repo for typescript projects.

Contains these tools:

1. Prettier for code formatting
2. TSLint for linting
3. Husky & lint-staged for pre-commit hooks (currently foirmats and then lints the code pre-commit)

All of your typescript files should go in the `./src` directory, and the compiled javscript will be available at `./dist`.

## Setup

-   Install the dependencies

`yarn`

-   Start the project. Typescript will be compiled automatically.

`yarn start`

You can now lint your project with `yarn lint` or `yarn lint-fix`
