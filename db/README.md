# Instructions to Use Dockerized Database

## Deploy the stack

Run this command in the directory where `docker-compose.yaml` file is located

```
docker compose up -d
```

Wait until the container is fully started up. Then you can use pgAdmin to view the database at http://localhost:2345 in your browser.

## pgAdmin Account

Login with the following credentials:

Username:

```
nttc@fakemail123.com
```

Password:

```
Nttc1234
```

## Connecting to postgres using pgAdmin

Onced logged in, use the following details to connect to the postgres database:

Host name:

```
postgres
```

Username:

```
postgres
```

Password:

```
nttc4
```

## Taking down the stack

Navigate to the location of the `docker-compose.yaml` file. Then run the following command:

```
docker compose down
```
