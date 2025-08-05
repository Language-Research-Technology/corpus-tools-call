# corpus-tools-call

## Install

Install dependencies:

```
npm install
```

## Usage
Create a `.env` file that containes the PostgreSQL connection string for each environment (eg: local, prod):
```
echo CALL_PG_URL=postgres://postgres:postgres@localhost:5432/postgres > .env.dev
echo CALL_PG_URL=postgres://user:pass@example.com:5432/dbname > .env.prod
```
Run the tool:
```
npm run prod
```