# MongoDB Docker Management Reference

A practical reference for managing the MongoDB instance running on the Azure VM through Docker.

> **Infrastructure:** Azure VM + Ubuntu 22.04 + Docker Compose
> **MongoDB container:** `mongodb`
> **Docker network:** `app_network`
> **MongoDB port:** `27017`
> **Data volume:** `mongodb_mongodb_data`
> **MongoDB image:** `mongodb/mongodb-community-server:latest`
> **Publicly exposed:** No
> **Authentication:** Enabled

---

## 1. MongoDB Directory

MongoDB's Docker Compose files are located at:

```bash
~/mongodb
```

Go to the directory:

```bash
cd ~/mongodb
```

Check the Compose configuration:

```bash
docker compose config
```

Check the Compose file:

```bash
cat ~/mongodb/docker-compose.yml
```

Safely view environment variable names without exposing values:

```bash
cat ~/mongodb/.env | sed 's/=.*$/=********/'
```

> Never publicly share the contents of `.env`.

---

# 2. Container Management

## Check MongoDB Status

```bash
docker compose ps
```

Or:

```bash
docker ps
```

Check all containers:

```bash
docker ps -a
```

---

## Start MongoDB

```bash
cd ~/mongodb
docker compose up -d
```

## Start an Existing Container

```bash
docker compose start
```

## Stop MongoDB

```bash
docker compose stop
```

## Restart MongoDB

```bash
docker compose restart
```

## Stop and Remove the Container

```bash
docker compose down
```

This removes the MongoDB container but **does not remove the named MongoDB data volume**.

## Stop and Remove Container + Data

```bash
docker compose down -v
```

> ⚠️ **DANGER:** `-v` removes the Docker volume containing MongoDB data. Do not use this unless you intentionally want to delete the database.

---

# 3. MongoDB Logs

Show recent logs:

```bash
docker logs --tail 50 mongodb
```

Follow logs in real time:

```bash
docker logs -f mongodb
```

Stop following logs:

```text
Ctrl+C
```

Show logs with timestamps:

```bash
docker logs -t --tail 100 mongodb
```

Check whether MongoDB is actually running:

```bash
docker inspect mongodb --format '{{.State.Status}}'
```

Expected:

```text
running
```

---

# 4. MongoDB Version

Check the MongoDB server version:

```bash
docker exec mongodb mongosh --quiet --eval "db.version()"
```

Check the Docker image:

```bash
docker image inspect mongodb/mongodb-community-server:latest --format '{{.RepoTags}}'
```

View complete image information:

```bash
docker image inspect mongodb/mongodb-community-server:latest
```

---

# 5. Connect to MongoDB Shell

The MongoDB administrator is:

```text
mongo_admin
```

Authentication database:

```text
admin
```

Open the MongoDB shell:

```bash
docker exec -it mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin
```

You will be prompted for the password.

Once inside:

```javascript
show dbs
```

Exit:

```javascript
exit
```

---

# 6. Test MongoDB

## Ping MongoDB

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"
```

Expected result:

```text
{ ok: 1 }
```

## Check Server Status

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.serverStatus().version"
```

---

# 7. Docker Network

MongoDB is connected to:

```text
app_network
```

Inspect the MongoDB network:

```bash
docker inspect mongodb --format '{{json .NetworkSettings.Networks}}'
```

Inspect the complete network:

```bash
docker network inspect app_network
```

List Docker networks:

```bash
docker network ls
```

Check which containers are connected to `app_network`:

```bash
docker network inspect app_network \
  --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}'
```

---

# 8. Docker-to-MongoDB Connection Test

Other Docker applications should connect to MongoDB using:

```text
mongodb:27017
```

They should **not** use:

```text
localhost:27017
```

and should normally **not** use the VM public IP.

Test MongoDB from another container:

```bash
docker run --rm \
  --network app_network \
  mongo:latest \
  mongosh \
  --host mongodb \
  --eval "db.adminCommand({ ping: 1 })"
```

Expected:

```text
{ ok: 1 }
```

> This confirms that Docker containers on `app_network` can reach MongoDB using the Docker service/container name.

---

# 9. MongoDB Databases

List databases:

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --quiet \
  --eval "db.adminCommand({ listDatabases: 1 }).databases.map(d => d.name)"
```

Inside `mongosh`:

```javascript
show dbs
```

Select a database:

```javascript
use test_app
```

Show the current database:

```javascript
db.getName()
```

---

# 10. Create a Test Database

MongoDB creates a database when data is actually stored.

Select the database:

```javascript
use test_app
```

Insert a test document:

```javascript
db.test.insertOne({
  message: "Hello MongoDB",
  createdAt: new Date()
})
```

Check the document:

```javascript
db.test.find().pretty()
```

Check the database:

```javascript
show dbs
```

---

# 11. Collections

List collections:

```javascript
show collections
```

Or:

```javascript
db.getCollectionNames()
```

Create a collection:

```javascript
db.createCollection("users")
```

Drop a collection:

```javascript
db.users.drop()
```

> ⚠️ Dropping a collection permanently deletes its documents.

---

# 12. Insert Documents

Insert one document:

```javascript
db.users.insertOne({
  name: "John",
  email: "john@example.com",
  createdAt: new Date()
})
```

Insert multiple documents:

```javascript
db.users.insertMany([
  {
    name: "John",
    email: "john@example.com",
    createdAt: new Date()
  },
  {
    name: "Jane",
    email: "jane@example.com",
    createdAt: new Date()
  }
])
```

---

# 13. Find Documents

Find everything:

```javascript
db.users.find()
```

Pretty output:

```javascript
db.users.find().pretty()
```

Find one document:

```javascript
db.users.findOne()
```

Find by field:

```javascript
db.users.find({
  email: "john@example.com"
})
```

Find by multiple fields:

```javascript
db.users.find({
  active: true,
  role: "user"
})
```

Find by MongoDB ID:

```javascript
db.users.findOne({
  _id: ObjectId("YOUR_OBJECT_ID")
})
```

Count documents:

```javascript
db.users.countDocuments()
```

Count matching documents:

```javascript
db.users.countDocuments({
  active: true
})
```

---

# 14. Update Documents

Update one document:

```javascript
db.users.updateOne(
  { email: "john@example.com" },
  {
    $set: {
      name: "John Updated"
    }
  }
)
```

Update multiple documents:

```javascript
db.users.updateMany(
  {},
  {
    $set: {
      active: true
    }
  }
)
```

Increment a number:

```javascript
db.users.updateOne(
  { email: "john@example.com" },
  {
    $inc: {
      loginCount: 1
    }
  }
)
```

Add a field:

```javascript
db.users.updateOne(
  { email: "john@example.com" },
  {
    $set: {
      verified: true
    }
  }
)
```

Remove a field:

```javascript
db.users.updateOne(
  { email: "john@example.com" },
  {
    $unset: {
      temporaryField: ""
    }
  }
)
```

---

# 15. Replace Documents

Replace an entire document:

```javascript
db.users.replaceOne(
  { email: "john@example.com" },
  {
    name: "John",
    email: "john@example.com",
    active: true
  }
)
```

> ⚠️ `replaceOne()` replaces the document rather than simply modifying selected fields. Be careful not to accidentally remove fields you intended to keep.

---

# 16. Delete Documents

Delete one:

```javascript
db.users.deleteOne({
  email: "john@example.com"
})
```

Delete multiple:

```javascript
db.users.deleteMany({
  active: false
})
```

Delete everything in a collection:

```javascript
db.users.deleteMany({})
```

> ⚠️ `deleteMany({})` deletes every document in that collection.

---

# 17. Database Management

Select a database:

```javascript
use test_app
```

Show current database:

```javascript
db.getName()
```

Drop the current database:

```javascript
db.dropDatabase()
```

> ⚠️ `db.dropDatabase()` permanently deletes the selected database.

---

# 18. MongoDB Users

The administrator user is:

```text
mongo_admin
```

Authentication database:

```text
admin
```

List users:

```bash
docker exec -it mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.getSiblingDB('admin').getUsers()"
```

Inside `mongosh`:

```javascript
use admin
show users
```

Or:

```javascript
db.getUsers()
```

---

# 19. Create an Application User

Applications should preferably use a dedicated MongoDB user instead of the administrator account.

Select the application database:

```javascript
use test_app
```

Create the application user:

```javascript
db.createUser({
  user: "test_app_user",
  pwd: passwordPrompt(),
  roles: [
    {
      role: "readWrite",
      db: "test_app"
    }
  ]
})
```

The application user should then connect to:

```text
test_app
```

instead of using the administrator account.

---

# 20. MongoDB Connection Strings

## From Another Docker Container

For the administrator:

```text
mongodb://mongo_admin:PASSWORD@mongodb:27017/?authSource=admin
```

For an application database:

```text
mongodb://test_app_user:PASSWORD@mongodb:27017/test_app
```

If the application user authenticates against `admin`:

```text
mongodb://test_app_user:PASSWORD@mongodb:27017/test_app?authSource=admin
```

> Replace `PASSWORD` with the actual password only in your secure environment configuration.

> Never commit real MongoDB connection strings or passwords to GitHub.

---

# 21. Test an Application Connection

From a container connected to `app_network`:

```bash
docker run --rm \
  --network app_network \
  mongo:latest \
  mongosh \
  "mongodb://mongo_admin:PASSWORD@mongodb:27017/?authSource=admin" \
  --eval "db.adminCommand({ ping: 1 })"
```

Expected:

```text
{ ok: 1 }
```

---

# 22. MongoDB Docker Volume

MongoDB data is stored in the named Docker volume:

```text
mongodb_mongodb_data
```

Inspect the volume:

```bash
docker volume inspect mongodb_mongodb_data
```

List Docker volumes:

```bash
docker volume ls
```

Check the volume's disk usage:

```bash
sudo du -sh /var/lib/docker/volumes/mongodb_mongodb_data/_data
```

MongoDB's data directory inside the container is:

```text
/data/db
```

The Docker volume is mounted there:

```text
mongodb_data:/data/db
```

---

# 23. Backup

Create a backup directory:

```bash
mkdir -p ~/mongodb/backups
```

Create a MongoDB dump inside the container:

```bash
docker exec mongodb mongodump \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --out /tmp/mongodb-backup
```

Copy the backup from the container to the VM:

```bash
docker cp mongodb:/tmp/mongodb-backup ~/mongodb/backups/
```

Check the backup:

```bash
ls -lah ~/mongodb/backups/
```

> A backup stored only on the same VM is not a complete disaster-recovery strategy. For important production data, keep a copy outside the VM as well.

---

# 24. Restore

Restore a MongoDB dump:

```bash
mongorestore \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  /path/to/backup
```

If the dump is inside the container:

```bash
docker exec mongodb mongorestore \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  /tmp/mongodb-backup
```

> Always verify the backup before relying on it for recovery.

---

# 25. MongoDB Image Updates

The Compose configuration currently uses:

```yaml
image: mongodb/mongodb-community-server:latest
```

Pull the latest image:

```bash
cd ~/mongodb
docker compose pull
```

Recreate MongoDB:

```bash
docker compose up -d
```

Check status:

```bash
docker compose ps
```

Check logs:

```bash
docker logs --tail 30 mongodb
```

Test MongoDB:

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"
```

Expected:

```text
{ ok: 1 }
```

> The MongoDB data is stored in the Docker volume, so recreating the container does not normally remove the database data.

---

# 26. Safe Update Workflow

Before updating MongoDB:

```bash
cd ~/mongodb
```

Check the current state:

```bash
docker compose ps
```

Check recent logs:

```bash
docker logs --tail 50 mongodb
```

Pull the latest image:

```bash
docker compose pull
```

Recreate the container:

```bash
docker compose up -d
```

Check status:

```bash
docker compose ps
```

Check logs:

```bash
docker logs --tail 50 mongodb
```

Test MongoDB:

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"
```

Expected:

```text
{ ok: 1 }
```

---

# 27. Environment Configuration

MongoDB initialization uses environment variables such as:

```text
MONGO_INITDB_ROOT_USERNAME
MONGO_INITDB_ROOT_PASSWORD
```

View variable names without exposing values:

```bash
cat ~/mongodb/.env | sed 's/=.*$/=********/'
```

Do **not** run or publicly share:

```bash
cat ~/mongodb/.env
```

Never commit `.env` to GitHub.

---

# 28. Verify MongoDB Is Private

Check whether Docker is publishing MongoDB to the VM:

```bash
docker port mongodb
```

If MongoDB is intentionally private, there should be no public host mapping such as:

```text
0.0.0.0:27017->27017/tcp
```

The Compose configuration should not contain:

```yaml
ports:
  - "27017:27017"
```

MongoDB should instead communicate through:

```text
app_network
```

Applications connected to that network should use:

```text
mongodb:27017
```

---

# 29. Current Docker Architecture

```text
                    INTERNET
                       |
                       v
                     CADDY
                       |
              +--------+--------+
              |                 |
              v                 v
           n8n:5678        hello_api:3000
              |                 |
              +--------+--------+
                       |
                       v
                 app_network
                       |
          +------------+------------+
          |            |            |
          v            v            v
      postgres       mongodb     other apps
       :5432         :27017
```

MongoDB:

```text
Container:        mongodb
Image:            mongodb/mongodb-community-server:latest
Port:             27017
Network:          app_network
Volume:           mongodb_mongodb_data
Data directory:   /data/db
Publicly exposed: No
Authentication:   Enabled
Admin user:       mongo_admin
```

---

# 30. Quick Health Check

Run these commands when you want to quickly verify MongoDB:

```bash
cd ~/mongodb
```

```bash
docker compose ps
```

```bash
docker logs --tail 30 mongodb
```

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"
```

```bash
docker inspect mongodb --format '{{.State.Status}}'
```

```bash
docker inspect mongodb --format '{{json .NetworkSettings.Networks}}'
```

Expected MongoDB state:

```text
running
```

Expected ping:

```text
{ ok: 1 }
```

---

# 31. Quick Command Cheat Sheet

```bash
# MongoDB directory
cd ~/mongodb

# Check status
docker compose ps

# Start
docker compose up -d

# Stop
docker compose stop

# Restart
docker compose restart

# Remove container
docker compose down

# Logs
docker logs --tail 50 mongodb

# Follow logs
docker logs -f mongodb

# MongoDB version
docker exec mongodb mongosh --quiet --eval "db.version()"

# Ping MongoDB
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"

# List databases
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --quiet \
  --eval "db.adminCommand({ listDatabases: 1 }).databases.map(d => d.name)"

# Open MongoDB shell
docker exec -it mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin

# Check Docker network
docker network inspect app_network

# Check MongoDB network
docker inspect mongodb --format '{{json .NetworkSettings.Networks}}'

# Check MongoDB volume
docker volume inspect mongodb_mongodb_data

# Check volume size
sudo du -sh /var/lib/docker/volumes/mongodb_mongodb_data/_data

# Pull latest image
docker compose pull

# Recreate container
docker compose up -d
```

---

# 32. Important Safety Rules

### Never casually run:

```bash
docker compose down -v
```

This can remove:

```text
mongodb_mongodb_data
```

and destroy the MongoDB data stored in that volume.

### Be careful with:

```javascript
db.dropDatabase()
```

```javascript
db.users.drop()
```

```javascript
db.users.deleteMany({})
```

These commands can permanently delete data.

### Keep MongoDB private

Do not expose:

```text
27017
```

to the public internet unless there is a specific, secured reason to do so.

Normal application communication should use:

```text
mongodb:27017
```

through:

```text
app_network
```

### Protect credentials

Never commit:

```text
MONGO_INITDB_ROOT_PASSWORD
```

or MongoDB connection strings containing passwords to GitHub.

Use environment variables or another secure secret-management method.

### Maintain backups

A Docker volume is **not a backup**.

For production data, maintain backups outside the MongoDB container and preferably outside the VM as well.

---

# 33. Recommended Daily Workflow

For normal VM maintenance:

```bash
cd ~/mongodb
docker compose ps
docker logs --tail 30 mongodb
```

If everything looks healthy, test:

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"
```

If MongoDB needs restarting:

```bash
docker compose restart
```

Then verify:

```bash
docker compose ps
```

and:

```bash
docker logs --tail 30 mongodb
```

For an image update:

```bash
docker compose pull
docker compose up -d
```

Then always verify:

```bash
docker compose ps
```

and:

```bash
docker exec mongodb mongosh \
  -u "mongo_admin" \
  -p \
  --authenticationDatabase admin \
  --eval "db.adminCommand({ ping: 1 })"
```

---

# 34. Final Infrastructure Reference

```text
VM
└── ~/mongodb
    ├── docker-compose.yml
    └── .env
         |
         v
Docker
└── mongodb
    ├── Image: mongodb/mongodb-community-server:latest
    ├── Port: 27017
    ├── Network: app_network
    ├── Volume: mongodb_mongodb_data
    └── Data: /data/db

Applications
└── app_network
    └── mongodb:27017

MongoDB Authentication
├── Admin user: mongo_admin
└── Auth database: admin

Security
├── MongoDB publicly exposed: No
├── Application access: Docker network
├── Credentials: .env / secrets
└── Public internet access to 27017: No
```

> **Golden rule:** Keep MongoDB private, use `mongodb:27017` from Docker applications, protect the `.env` credentials, and never remove `mongodb_mongodb_data` unless you intentionally want to destroy the database.
