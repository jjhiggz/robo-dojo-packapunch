# Docker Database Setup

This Docker Compose file provides a local PostgreSQL database for development.

## Usage

Start the database:
```bash
docker-compose up -d
```

Stop the database:
```bash
docker-compose down
```

Stop and remove volumes (deletes all data):
```bash
docker-compose down -v
```

## Connection

The database is available at:
- Host: `localhost`
- Port: `5432`
- User: `musicqueue`
- Password: `musicqueue`
- Database: `musicqueue`

Connection string:
```
postgresql://musicqueue:musicqueue@localhost:5432/musicqueue
```

Add this to your `.env.local` file:
```
DATABASE_URL=postgresql://musicqueue:musicqueue@localhost:5432/musicqueue
```

## Setup Schema

After starting the database, run:
```bash
npm run db:push
```

