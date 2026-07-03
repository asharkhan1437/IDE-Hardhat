import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';
import { ethers } from 'ethers';
import axios from 'axios';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PROJECTS_DIR = path.join(__dirname, 'projects');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const COMPOSE_DIR = path.join(__dirname, 'compose');  // where compose files live

fs.ensureDirSync(PROJECTS_DIR);
fs.ensureDirSync(TEMPLATES_DIR);
fs.ensureDirSync(COMPOSE_DIR);

// ── PERSISTED PURCHASE STORE ──
const PURCHASES_FILE = path.join(__dirname, 'purchases.json');

const loadPurchases = () => {
  try {
    if (fs.existsSync(PURCHASES_FILE)) {
      return JSON.parse(fs.readFileSync(PURCHASES_FILE, 'utf8'));
    }
  } catch {}
  return {};
};

const savePurchases = (data) => {
  try {
    fs.writeFileSync(PURCHASES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save purchases:', err.message);
  }
};

const purchasedExtensions = loadPurchases();
console.log(`📦 Loaded ${Object.keys(purchasedExtensions).length} wallet purchase records`);

// ── RUNNING CONTAINERS TRACKER ──
const runningServices = {};

// ── STORE WALLET ──
const STORE_WALLET = "0xA9FAABCD9372AA1FCD175c3f1a7CfA0b0f8a7916";

// ── GITHUB APP CREDENTIALS ──
const CLIENT_ID = "Ov23li2xmxwOUm9hqgib";
const CLIENT_SECRET = "49e4809f04bd12faecc42ce7290df46614904270";
// Frontend dev server — update if your port differs
const FRONTEND_URL = "http://localhost:5173";

// ── DOCKER COMPOSE CONFIGS PER EXTENSION ──
const COMPOSE_CONFIGS = {
  portainer: { url: "http://localhost:9000", compose: `services:\n  portainer:\n    image: portainer/portainer-ce:latest\n    ports:\n      - "9000:9000"\n      - "9443:9443"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n      - portainer_data:/data\n    restart: always\nvolumes:\n  portainer_data:` },
  nginx: { url: "http://localhost:8080", compose: `services:\n  nginx:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n    restart: always` },
  tomcat: { url: "http://localhost:8100", compose: `services:\n  tomcat:\n    image: tomcat:10-jdk17\n    ports:\n      - "8100:8080"\n    volumes:\n      - tomcat_webapps:/usr/local/tomcat/webapps\n    restart: always\nvolumes:\n  tomcat_webapps:` },
  httpd: { url: "http://localhost:8101", compose: `services:\n  httpd:\n    image: httpd:alpine\n    ports:\n      - "8101:80"\n    restart: always` },
  jboss: { url: "http://localhost:8102", compose: `services:\n  wildfly:\n    image: quay.io/wildfly/wildfly:latest\n    ports:\n      - "8102:8080"\n      - "9991:9990"\n    command: /opt/jboss/wildfly/bin/standalone.sh -b 0.0.0.0 -bmanagement 0.0.0.0\n    restart: always` },
  postgres: { url: "http://localhost:5050", compose: `services:\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: admin\n      POSTGRES_PASSWORD: secret\n      POSTGRES_DB: appdb\n    ports:\n      - "5432:5432"\n    volumes:\n      - postgres_data:/var/lib/postgresql/data\n    restart: always\n  pgadmin:\n    image: dpage/pgadmin4:latest\n    environment:\n      PGADMIN_DEFAULT_EMAIL: admin@zicon.dev\n      PGADMIN_DEFAULT_PASSWORD: secret\n    ports:\n      - "5050:80"\n    depends_on:\n      - postgres\n    restart: always\nvolumes:\n  postgres_data:` },
  redis: { url: "http://localhost:8083", compose: `services:\n  redis:\n    image: redis:alpine\n    ports:\n      - "6379:6379"\n    volumes:\n      - redis_data:/data\n    command: redis-server --appendonly yes\n    restart: always\n  redis-commander:\n    image: rediscommander/redis-commander:latest\n    environment:\n      - REDIS_HOSTS=local:redis:6379\n    ports:\n      - "8083:8081"\n    depends_on:\n      - redis\n    restart: always\nvolumes:\n  redis_data:` },
  traefik: { url: "http://localhost:8082", compose: `services:\n  traefik:\n    image: traefik:v3.0\n    command:\n      - "--api.insecure=true"\n      - "--api.dashboard=true"\n      - "--providers.docker=true"\n      - "--entrypoints.web.address=:80"\n    ports:\n      - "8080:80"\n      - "8082:8080"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n    restart: always` },
  grafana: { url: "http://localhost:3001", compose: `services:\n  grafana:\n    image: grafana/grafana:latest\n    ports:\n      - "3001:3000"\n    environment:\n      - GF_SECURITY_ADMIN_PASSWORD=admin\n    volumes:\n      - grafana_data:/var/lib/grafana\n    restart: always\nvolumes:\n  grafana_data:` },
  prometheus: { url: "http://localhost:9090", compose: `services:\n  prometheus:\n    image: prom/prometheus:latest\n    ports:\n      - "9090:9090"\n    volumes:\n      - prometheus_data:/prometheus\n    restart: always\nvolumes:\n  prometheus_data:` },
  mongodb: { url: "http://localhost:8081", compose: `services:\n  mongodb:\n    image: mongo:7\n    environment:\n      MONGO_INITDB_ROOT_USERNAME: admin\n      MONGO_INITDB_ROOT_PASSWORD: secret\n    ports:\n      - "27017:27017"\n    volumes:\n      - mongo_data:/data/db\n    restart: always\n  mongo-express:\n    image: mongo-express:latest\n    ports:\n      - "8081:8081"\n    environment:\n      ME_CONFIG_MONGODB_ADMINUSERNAME: admin\n      ME_CONFIG_MONGODB_ADMINPASSWORD: secret\n      ME_CONFIG_MONGODB_URL: mongodb://admin:secret@mongodb:27017/\n      ME_CONFIG_BASICAUTH: "false"\n    depends_on:\n      - mongodb\n    restart: always\nvolumes:\n  mongo_data:` },
  mysql: { url: "http://localhost:8085", compose: `services:\n  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: appdb\n    ports:\n      - "3306:3306"\n    volumes:\n      - mysql_data:/var/lib/mysql\n    restart: always\n  phpmyadmin:\n    image: phpmyadmin:latest\n    ports:\n      - "8085:80"\n    environment:\n      PMA_HOST: mysql\n    depends_on:\n      - mysql\n    restart: always\nvolumes:\n  mysql_data:` },
  mariadb: { url: "http://localhost:8087", compose: `services:\n  mariadb:\n    image: mariadb:11\n    environment:\n      MARIADB_ROOT_PASSWORD: secret\n      MARIADB_DATABASE: appdb\n    ports:\n      - "3307:3306"\n    volumes:\n      - mariadb_data:/var/lib/mysql\n    restart: always\n  phpmyadmin:\n    image: phpmyadmin:latest\n    ports:\n      - "8087:80"\n    environment:\n      PMA_HOST: mariadb\n    depends_on:\n      - mariadb\n    restart: always\nvolumes:\n  mariadb_data:` },
  mssql: { url: "http://localhost:8099", compose: `services:\n  mssql:\n    image: mcr.microsoft.com/mssql/server:2022-latest\n    environment:\n      SA_PASSWORD: "Secret123!"\n      ACCEPT_EULA: "Y"\n    ports:\n      - "1433:1433"\n    volumes:\n      - mssql_data:/var/opt/mssql\n    restart: always\n  adminer:\n    image: adminer:latest\n    ports:\n      - "8099:8080"\n    restart: always\nvolumes:\n  mssql_data:` },
  elasticsearch: { url: "http://localhost:5601", compose: `services:\n  elasticsearch:\n    image: elasticsearch:8.11.0\n    environment:\n      - discovery.type=single-node\n      - xpack.security.enabled=false\n      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"\n    ports:\n      - "9200:9200"\n    volumes:\n      - es_data:/usr/share/elasticsearch/data\n    restart: always\n  kibana:\n    image: kibana:8.11.0\n    ports:\n      - "5601:5601"\n    environment:\n      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200\n    depends_on:\n      - elasticsearch\n    restart: always\nvolumes:\n  es_data:` },
  influxdb: { url: "http://localhost:8086", compose: `services:\n  influxdb:\n    image: influxdb:2\n    ports:\n      - "8086:8086"\n    environment:\n      - DOCKER_INFLUXDB_INIT_MODE=setup\n      - DOCKER_INFLUXDB_INIT_USERNAME=admin\n      - DOCKER_INFLUXDB_INIT_PASSWORD=secret123\n      - DOCKER_INFLUXDB_INIT_ORG=zicon\n      - DOCKER_INFLUXDB_INIT_BUCKET=metrics\n    volumes:\n      - influxdb_data:/var/lib/influxdb2\n    restart: always\nvolumes:\n  influxdb_data:` },
  couchdb: { url: "http://localhost:5984", compose: `services:\n  couchdb:\n    image: couchdb:latest\n    ports:\n      - "5984:5984"\n    environment:\n      COUCHDB_USER: admin\n      COUCHDB_PASSWORD: secret\n    volumes:\n      - couchdb_data:/opt/couchdb/data\n    restart: always\nvolumes:\n  couchdb_data:` },
  neo4j: { url: "http://localhost:7474", compose: `services:\n  neo4j:\n    image: neo4j:latest\n    ports:\n      - "7474:7474"\n      - "7687:7687"\n    environment:\n      NEO4J_AUTH: neo4j/secret123\n    volumes:\n      - neo4j_data:/data\n    restart: always\nvolumes:\n  neo4j_data:` },
  adminer: { url: "http://localhost:8089", compose: `services:\n  adminer:\n    image: adminer:latest\n    ports:\n      - "8089:8080"\n    restart: always` },
  wordpress: { url: "http://localhost:8090", compose: `services:\n  wordpress:\n    image: wordpress:latest\n    ports:\n      - "8090:80"\n    environment:\n      WORDPRESS_DB_HOST: mysql\n      WORDPRESS_DB_USER: admin\n      WORDPRESS_DB_PASSWORD: secret\n      WORDPRESS_DB_NAME: wordpress\n    volumes:\n      - wordpress_data:/var/www/html\n    depends_on:\n      - mysql\n    restart: always\n  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: wordpress\n      MYSQL_USER: admin\n      MYSQL_PASSWORD: secret\n    volumes:\n      - wordpress_db:/var/lib/mysql\n    restart: always\nvolumes:\n  wordpress_data:\n  wordpress_db:` },
  ghost: { url: "http://localhost:2368", compose: `services:\n  ghost:\n    image: ghost:latest\n    ports:\n      - "2368:2368"\n    environment:\n      database__client: sqlite3\n      NODE_ENV: development\n    volumes:\n      - ghost_data:/var/lib/ghost/content\n    restart: always\nvolumes:\n  ghost_data:` },
  strapi: { url: "http://localhost:1337", compose: `services:\n  strapi:\n    image: node:20-alpine\n    working_dir: /app\n    ports:\n      - "1337:1337"\n    command: sh -c "npx create-strapi-app@latest app --quickstart --no-run && cd app && npm run develop"\n    volumes:\n      - strapi_data:/app\n    restart: always\nvolumes:\n  strapi_data:` },
  rabbitmq: { url: "http://localhost:15672", compose: `services:\n  rabbitmq:\n    image: rabbitmq:3-management\n    ports:\n      - "5672:5672"\n      - "15672:15672"\n    environment:\n      RABBITMQ_DEFAULT_USER: admin\n      RABBITMQ_DEFAULT_PASS: secret\n    volumes:\n      - rabbitmq_data:/var/lib/rabbitmq\n    restart: always\nvolumes:\n  rabbitmq_data:` },
  kafka: { url: "http://localhost:9092", compose: `services:\n  zookeeper:\n    image: confluentinc/cp-zookeeper:latest\n    environment:\n      ZOOKEEPER_CLIENT_PORT: 2181\n    restart: always\n  kafka:\n    image: confluentinc/cp-kafka:latest\n    ports:\n      - "9092:9092"\n    environment:\n      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181\n      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092\n      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1\n    depends_on:\n      - zookeeper\n    restart: always` },
  nats: { url: "http://localhost:8222", compose: `services:\n  nats:\n    image: nats:latest\n    ports:\n      - "4222:4222"\n      - "8222:8222"\n    command: --http_port 8222\n    restart: always` },
  minio: { url: "http://localhost:9003", compose: `services:\n  minio:\n    image: minio/minio\n    ports:\n      - "9002:9000"\n      - "9003:9001"\n    environment:\n      MINIO_ROOT_USER: admin\n      MINIO_ROOT_PASSWORD: secret123\n    command: server /data --console-address ":9001"\n    volumes:\n      - minio_data:/data\n    restart: always\nvolumes:\n  minio_data:` },
  nextcloud: { url: "http://localhost:8091", compose: `services:\n  nextcloud:\n    image: nextcloud:latest\n    ports:\n      - "8091:80"\n    environment:\n      MYSQL_HOST: mysql\n      MYSQL_DATABASE: nextcloud\n      MYSQL_USER: admin\n      MYSQL_PASSWORD: secret\n    volumes:\n      - nextcloud_data:/var/www/html\n    depends_on:\n      - mysql\n    restart: always\n  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: nextcloud\n      MYSQL_USER: admin\n      MYSQL_PASSWORD: secret\n    volumes:\n      - nextcloud_db:/var/lib/mysql\n    restart: always\nvolumes:\n  nextcloud_data:\n  nextcloud_db:` },
  seafile: { url: "http://localhost:8092", compose: `services:\n  seafile:\n    image: seafileltd/seafile-mc:latest\n    ports:\n      - "8092:80"\n    environment:\n      DB_HOST: mysql\n      DB_ROOT_PASSWD: secret\n      SEAFILE_ADMIN_EMAIL: admin@zicon.dev\n      SEAFILE_ADMIN_PASSWORD: secret123\n    volumes:\n      - seafile_data:/shared\n    restart: always\nvolumes:\n  seafile_data:` },
  wireguard: { url: "http://localhost:51820", compose: `services:\n  wireguard:\n    image: linuxserver/wireguard\n    cap_add:\n      - NET_ADMIN\n      - SYS_MODULE\n    environment:\n      - PUID=1000\n      - PGID=1000\n      - SERVERURL=localhost\n      - PEERS=3\n    ports:\n      - "51820:51820/udp"\n    volumes:\n      - wireguard_data:/config\n    sysctls:\n      - net.ipv4.conf.all.src_valid_mark=1\n    restart: always\nvolumes:\n  wireguard_data:` },
  pihole: { url: "http://localhost:8093", compose: `services:\n  pihole:\n    image: pihole/pihole:latest\n    ports:\n      - "53:53/tcp"\n      - "53:53/udp"\n      - "8093:80"\n    environment:\n      TZ: America/New_York\n      WEBPASSWORD: secret\n    volumes:\n      - pihole_data:/etc/pihole\n    restart: always\nvolumes:\n  pihole_data:` },
  "nginx-proxy-manager": { url: "http://localhost:8095", compose: `services:\n  npm:\n    image: jc21/nginx-proxy-manager:latest\n    ports:\n      - "8094:80"\n      - "8443:443"\n      - "8095:81"\n    volumes:\n      - npm_data:/data\n      - npm_ssl:/etc/letsencrypt\n    restart: always\nvolumes:\n  npm_data:\n  npm_ssl:` },
  jenkins: { url: "http://localhost:8084", compose: `services:\n  jenkins:\n    image: jenkins/jenkins:lts\n    ports:\n      - "8084:8080"\n      - "50000:50000"\n    volumes:\n      - jenkins_data:/var/jenkins_home\n    restart: always\nvolumes:\n  jenkins_data:` },
  sonarqube: { url: "http://localhost:9001", compose: `services:\n  sonarqube:\n    image: sonarqube:community\n    ports:\n      - "9001:9000"\n    environment:\n      - SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true\n    volumes:\n      - sonarqube_data:/opt/sonarqube/data\n    restart: always\nvolumes:\n  sonarqube_data:` },
  gitea: { url: "http://localhost:3003", compose: `services:\n  gitea:\n    image: gitea/gitea:latest\n    ports:\n      - "3003:3000"\n      - "222:22"\n    volumes:\n      - gitea_data:/data\n    restart: always\nvolumes:\n  gitea_data:` },
  drone: { url: "http://localhost:8086", compose: `services:\n  drone:\n    image: drone/drone:2\n    ports:\n      - "8086:80"\n    environment:\n      - DRONE_GITEA_SERVER=http://localhost:3003\n      - DRONE_RPC_SECRET=secret\n      - DRONE_SERVER_HOST=localhost:8086\n      - DRONE_SERVER_PROTO=http\n    volumes:\n      - drone_data:/data\n    restart: always\nvolumes:\n  drone_data:` },
  loki: { url: "http://localhost:3100", compose: `services:\n  loki:\n    image: grafana/loki:latest\n    ports:\n      - "3100:3100"\n    restart: always\n  promtail:\n    image: grafana/promtail:latest\n    volumes:\n      - /var/log:/var/log\n    restart: always` },
  fastapi: { url: "http://localhost:8001", compose: `services:\n  fastapi:\n    image: python:3.11\n    working_dir: /app\n    ports:\n      - "8001:8000"\n    command: sh -c "pip install fastapi uvicorn && uvicorn main:app --host 0.0.0.0 --reload"\n    volumes:\n      - .:/app\n    restart: always` },
  "express-mongo": { url: "http://localhost:3004", compose: `services:\n  express:\n    image: node:20-alpine\n    working_dir: /app\n    ports:\n      - "3004:3000"\n    command: sh -c "npm install && node index.js"\n    depends_on:\n      - mongodb\n  mongodb:\n    image: mongo:7\n    ports:\n      - "27017:27017"` },
  "aspnet-mssql": { url: "http://localhost:8002", compose: `services:\n  aspnet:\n    image: mcr.microsoft.com/dotnet/aspnet:8.0\n    ports:\n      - "8002:80"\n    depends_on:\n      - mssql\n  mssql:\n    image: mcr.microsoft.com/mssql/server:2022-latest\n    environment:\n      SA_PASSWORD: "Secret123!"\n      ACCEPT_EULA: "Y"\n    ports:\n      - "1433:1433"` },
  "nginx-flask-mysql": { url: "http://localhost:8088", compose: `services:\n  nginx:\n    image: nginx:alpine\n    ports:\n      - "8088:80"\n    depends_on:\n      - flask\n  flask:\n    image: python:3.11-alpine\n    working_dir: /app\n    command: sh -c "pip install flask mysql-connector-python && python app.py"\n  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: appdb` },
  flask: { url: "http://localhost:5002", compose: `services:\n  flask:\n    image: python:3.11-alpine\n    working_dir: /app\n    ports:\n      - "5002:5000"\n    command: sh -c "pip install flask && python app.py"\n    restart: always` },
  dotnet: { url: "http://localhost:8003", compose: `services:\n  dotnet:\n    image: mcr.microsoft.com/dotnet/sdk:8.0\n    working_dir: /app\n    ports:\n      - "8003:8080"\n    command: sh -c "dotnet run"\n    restart: always` },
  rails: { url: "http://localhost:3006", compose: `services:\n  rails:\n    image: ruby:3.3\n    working_dir: /app\n    ports:\n      - "3006:3000"\n    command: sh -c "gem install rails && bundle install && rails server -b 0.0.0.0"\n    depends_on:\n      - postgres\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret` },
  springboot: { url: "http://localhost:8004", compose: `services:\n  springboot:\n    image: eclipse-temurin:21-jdk\n    working_dir: /app\n    ports:\n      - "8004:8080"\n    command: sh -c "./mvnw spring-boot:run"\n    depends_on:\n      - postgres\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret` },
  spark: { url: "http://localhost:8005", compose: `services:\n  spark-master:\n    image: apache/spark:latest\n    command: /opt/spark/bin/spark-class org.apache.spark.deploy.master.Master\n    ports:\n      - "8005:8080"\n      - "7077:7077"\n    restart: always\n  spark-worker:\n    image: apache/spark:latest\n    command: /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker spark://spark-master:7077\n    depends_on:\n      - spark-master\n    restart: always` },
  "flask-redis": { url: "http://localhost:5001", compose: `services:\n  flask:\n    image: python:3.11-alpine\n    working_dir: /app\n    ports:\n      - "5001:5000"\n    environment:\n      - REDIS_URL=redis://redis:6379\n    command: sh -c "pip install flask redis && python app.py"\n    depends_on:\n      - redis\n  redis:\n    image: redis:alpine` },
  "django-postgres": { url: "http://localhost:8000", compose: `services:\n  django:\n    image: python:3.11\n    working_dir: /app\n    ports:\n      - "8000:8000"\n    command: sh -c "pip install django psycopg2-binary && python manage.py runserver 0.0.0.0:8000"\n    depends_on:\n      - postgres\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: admin\n      POSTGRES_PASSWORD: secret\n      POSTGRES_DB: appdb` },
  ipfs: { url: "http://localhost:8096", compose: `services:\n  ipfs:\n    image: ipfs/kubo:latest\n    ports:\n      - "4001:4001"\n      - "5001:5001"\n      - "8096:8080"\n    volumes:\n      - ipfs_data:/data/ipfs\n    restart: always\nvolumes:\n  ipfs_data:` },
  "the-graph": { url: "http://localhost:8000", compose: `services:\n  graph-node:\n    image: graphprotocol/graph-node:latest\n    ports:\n      - "8097:8000"\n      - "8098:8020"\n    environment:\n      postgres_host: postgres\n      postgres_user: admin\n      postgres_pass: secret\n      postgres_db: graph\n      ipfs: "ipfs:5001"\n      ethereum: "sepolia:https://rpc.ankr.com/eth_sepolia"\n    depends_on:\n      - postgres\n      - ipfs\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: admin\n      POSTGRES_PASSWORD: secret\n      POSTGRES_DB: graph\n  ipfs:\n    image: ipfs/kubo:latest\n    ports:\n      - "5001:5001"` },
  jupyter: { url: "http://localhost:8888/?token=zicon", compose: `services:\n  jupyter:\n    image: jupyter/scipy-notebook:latest\n    ports:\n      - "8888:8888"\n    environment:\n      - JUPYTER_TOKEN=zicon\n    volumes:\n      - jupyter_data:/home/jovyan/work\n    restart: always\nvolumes:\n  jupyter_data:` },
};

// ── EXTENSION CATALOG ──
const EXTENSION_CATALOG = [
  { id: "portainer",            name: "Portainer",              price: "0.001",  category: "devops"    },
  { id: "traefik",              name: "Traefik",                price: "0.001",  category: "devops"    },
  { id: "grafana",              name: "Grafana",                price: "0.001",  category: "devops"    },
  { id: "prometheus",           name: "Prometheus",             price: "0.001",  category: "devops"    },
  { id: "jenkins",              name: "Jenkins",                price: "0.002",  category: "devops"    },
  { id: "sonarqube",            name: "SonarQube",              price: "0.002",  category: "devops"    },
  { id: "gitea",                name: "Gitea",                  price: "0.001",  category: "devops"    },
  { id: "drone",                name: "Drone CI",               price: "0.002",  category: "devops"    },
  { id: "loki",                 name: "Loki",                   price: "0.001",  category: "devops"    },
  { id: "react-app",            name: "React + Vite",           price: "0.0005", category: "frontend"  },
  { id: "nextjs",               name: "Next.js",                price: "0.001",  category: "frontend"  },
  { id: "angular-nginx",        name: "Angular",                price: "0.001",  category: "frontend"  },
  { id: "vue-nginx",            name: "Vue 3",                   price: "0.001",  category: "frontend"  },
  { id: "svelte",               name: "SvelteKit",              price: "0.001",  category: "frontend"  },
  { id: "nginx",                name: "Nginx",                  price: "0.0005", category: "backend"   },
  { id: "tomcat",               name: "Apache Tomcat",          price: "0.001",  category: "backend"   },
  { id: "httpd",                name: "Apache HTTPD",           price: "0.0005", category: "backend"   },
  { id: "jboss",                name: "JBoss / WildFly",        price: "0.002",  category: "backend"   },
  { id: "flask-redis",          name: "Flask + Redis",          price: "0.001",  category: "backend"   },
  { id: "django-postgres",      name: "Django + PostgreSQL",    price: "0.001",  category: "backend"   },
  { id: "fastapi",              name: "FastAPI",                price: "0.001",  category: "backend"   },
  { id: "express-mongo",        name: "Express + MongoDB",      price: "0.001",  category: "backend"   },
  { id: "aspnet-mssql",         name: "ASP.NET + MSSQL",        price: "0.002",  category: "backend"   },
  { id: "nginx-flask-mysql",    name: "Nginx + Flask + MySQL",  price: "0.001",  category: "backend"   },
  { id: "flask",                name: "Flask",                  price: "0.0005", category: "backend"   },
  { id: "nodejs",               name: "Node.js",                price: "0.0005", category: "backend"   },
  { id: "dotnet",               name: ".NET",                   price: "0.001",  category: "backend"   },
  { id: "rails",                name: "Ruby on Rails",          price: "0.001",  category: "backend"   },
  { id: "springboot",           name: "Spring Boot",            price: "0.001",  category: "backend"   },
  { id: "spark",                name: "Apache Spark",           price: "0.002",  category: "backend"   },
  { id: "postgres",             name: "PostgreSQL",             price: "0.001",  category: "database"  },
  { id: "mongodb",              name: "MongoDB",                price: "0.001",  category: "database"  },
  { id: "redis",                name: "Redis",                  price: "0.0005", category: "database"  },
  { id: "mysql",                name: "MySQL",                  price: "0.001",  category: "database"  },
  { id: "mariadb",              name: "MariaDB",                price: "0.001",  category: "database"  },
  { id: "mssql",                name: "MSSQL Server",           price: "0.002",  category: "database"  },
  { id: "elasticsearch",        name: "Elasticsearch + Kibana", price: "0.002",  category: "database"  },
  { id: "influxdb",             name: "InfluxDB",               price: "0.001",  category: "database"  },
  { id: "couchdb",              name: "CouchDB",                price: "0.001",  category: "database"  },
  { id: "neo4j",                name: "Neo4j",                  price: "0.002",  category: "database"  },
  { id: "adminer",              name: "Adminer",                price: "0.0005", category: "database"  },
  { id: "wordpress",            name: "WordPress + MySQL",      price: "0.001",  category: "cms"       },
  { id: "ghost",                name: "Ghost",                  price: "0.001",  category: "cms"       },
  { id: "strapi",               name: "Strapi CMS",             price: "0.002",  category: "cms"       },
  { id: "rabbitmq",             name: "RabbitMQ",               price: "0.001",  category: "messaging" },
  { id: "kafka",                name: "Kafka",                  price: "0.002",  category: "messaging" },
  { id: "nats",                 name: "NATS",                   price: "0.001",  category: "messaging" },
  { id: "minio",                name: "MinIO",                  price: "0.001",  category: "storage"   },
  { id: "nextcloud",            name: "Nextcloud",              price: "0.002",  category: "storage"   },
  { id: "seafile",              name: "Seafile",                price: "0.002",  category: "storage"   },
  { id: "wireguard",            name: "WireGuard VPN",          price: "0.002",  category: "network"   },
  { id: "pihole",               name: "Pi-hole",                price: "0.001",  category: "network"   },
  { id: "nginx-proxy-manager",  name: "Nginx Proxy Manager",    price: "0.001",  category: "network"   },
  { id: "web3-auth",            name: "Web3 Auth (SIWE)",       price: "0.002",  category: "web3"      },
  { id: "hardhat",              name: "Hardhat Node",           price: "0.002",  category: "web3"      },
  { id: "ipfs",                 name: "IPFS Node",              price: "0.002",  category: "web3"      },
  { id: "the-graph",            name: "The Graph",              price: "0.003",  category: "web3"      },
  { id: "jupyter",               name: "Jupyter Notebook",       price: "0.001",  category: "ai"        },
  { id: "claude-code",           name: "Claude Code",            price: "0.002",  category: "ai"        },
  { id: "cursor-ide",            name: "Cursor AI IDE",          price: "0.001",  category: "ai"        },
  { id: "notebooklm",            name: "Google NotebookLM",      price: "0.0005", category: "ai"        },
];

// Helper: Recursively read directory
const readDirectoryRecursive = (dir, rootDir, fileList = {}) => {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      if (!['.git', 'node_modules', 'dist', '.next', 'cache', 'artifacts'].includes(item)) {
        readDirectoryRecursive(fullPath, rootDir, fileList);
      }
    } else {
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      try {
        fileList[relativePath] = fs.readFileSync(fullPath, 'utf8');
      } catch {
        // skip binary files
      }
    }
  });
  return fileList;
};

// ── NEW: GET EXTENSIONS LIST ──
app.get('/api/extensions', (req, res) => {
  res.json({ success: true, extensions: EXTENSION_CATALOG });
});

// ── NEW: GET OWNED EXTENSIONS FOR WALLET ──
app.get('/api/extensions/owned/:address', (req, res) => {
  const { address } = req.params;
  const owned = purchasedExtensions[address.toLowerCase()] || [];
  res.json({ success: true, owned });
});

// ── GITHUB AUTH CALLBACK ──
app.get('/api/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided by GitHub");
  try {
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
      { headers: { Accept: 'application/json' } }
    );
    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) throw new Error("Failed to obtain access token");
    // Backend already exchanged the code — send the token directly.
    // Frontend reads ?gh_token= and stores it, no further exchange needed.
    res.redirect(`${FRONTEND_URL}/?gh_token=${accessToken}`);
  } catch (err) {
    console.error("GitHub OAuth error:", err.response?.data || err.message);
    res.redirect(`${FRONTEND_URL}/?gh_error=1`);
  }
});

// ── GITHUB: LIST AUTHENTICATED USER'S REPOS ──
app.get('/api/github/repos', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ success: false, message: "No token provided" });
  try {
    const ghRes = await axios.get('https://api.github.com/user/repos', {
      headers: { Authorization: auth, Accept: 'application/vnd.github+json' },
      params: { per_page: 100, sort: 'updated', affiliation: 'owner,collaborator' },
    });
    const repos = ghRes.data.map(r => ({
      name: r.name,
      fullName: r.full_name,
      cloneUrl: r.clone_url,
      htmlUrl: r.html_url,
      private: r.private,
      fork: r.fork,
      owner: r.owner?.login,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
    }));
    res.json({ success: true, repos });
  } catch (err) {
    console.error("GitHub repos error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Failed to fetch repos",
    });
  }
});

// ── GITHUB: FORK A REPO ──
app.post('/api/github/fork', async (req, res) => {
  const { fullName, token } = req.body;
  if (!fullName || !token) {
    return res.status(400).json({ success: false, message: "Missing fullName or token" });
  }
  try {
    const ghRes = await axios.post(
      `https://api.github.com/repos/${fullName}/forks`,
      {},
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    const r = ghRes.data;
    res.json({
      success: true,
      repo: {
        name: r.name,
        fullName: r.full_name,
        cloneUrl: r.clone_url,
        htmlUrl: r.html_url,
        private: r.private,
        fork: true,
        owner: r.owner?.login,
        defaultBranch: r.default_branch,
      },
    });
  } catch (err) {
    console.error("GitHub fork error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Fork failed",
    });
  }
});

// ── GITHUB: CREATE A NEW REPO ──
app.post('/api/github/create-repo', async (req, res) => {
  const { name, isPrivate, token } = req.body;
  if (!name || !token) {
    return res.status(400).json({ success: false, message: "Missing name or token" });
  }
  try {
    const ghRes = await axios.post(
      'https://api.github.com/user/repos',
      { name, private: !!isPrivate, auto_init: true },
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    const r = ghRes.data;
    res.json({
      success: true,
      repo: {
        name: r.name,
        fullName: r.full_name,
        cloneUrl: r.clone_url,
        htmlUrl: r.html_url,
        private: r.private,
        fork: false,
        owner: r.owner?.login,
        defaultBranch: r.default_branch,
      },
    });
  } catch (err) {
    console.error("GitHub create-repo error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Repo creation failed",
    });
  }
});

// ── 1. AUTOSAVE ──
app.post('/api/save', async (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: "No path" });
  const fullPath = path.join(PROJECTS_DIR, filePath);
  try {
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. GITHUB CLONE ──
app.post('/api/clone', async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ success: false, message: "No URL" });

  const repoName = repoUrl.split('/').pop().replace('.git', '');
  const clonePath = path.join(PROJECTS_DIR, repoName);

  try {
    await fs.ensureDir(PROJECTS_DIR);
    if (await fs.pathExists(clonePath)) await fs.remove(clonePath);

    const git = simpleGit();
    await git.clone(repoUrl, clonePath);

    const files = readDirectoryRecursive(clonePath, clonePath);
    res.json({ success: true, files, repoName });
  } catch (err) {
    console.error("Clone Error:", err.message);
    res.status(500).json({ success: false, message: "Clone failed." });
  }
});

// ── 2.5 GITHUB PULL ──
app.post('/api/pull', async (req, res) => {
  const { repoName, repoUrl, token } = req.body;
  if (!repoName || !repoUrl) {
    return res.status(400).json({ success: false, message: "Missing repoName or repoUrl" });
  }
  const repoPath = path.join(PROJECTS_DIR, repoName);

  try {
    if (!(await fs.pathExists(repoPath)) || !(await simpleGit(repoPath).checkIsRepo())) {
      return res.status(404).json({ success: false, message: "Local repo not found — clone it first." });
    }

    const git = simpleGit(repoPath);

    if (token) {
      const cleanUrl = repoUrl.replace(/^https?:\/\//, '');
      const authUrl = `https://${token}@${cleanUrl}`;
      try { await git.pull(authUrl, 'main'); }
      catch { await git.pull(authUrl, 'master'); }
    } else {
      try { await git.pull('origin', 'main'); }
      catch { await git.pull('origin', 'master'); }
    }

    const files = readDirectoryRecursive(repoPath, repoPath);
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 3. GITHUB PUSH ──
app.post('/api/push', async (req, res) => {
  const { files, token, repoName, repoUrl, commitMessage } = req.body;
  if (!repoUrl || !token) return res.status(400).json({ success: false, message: "Missing URL or Token" });
  const repoPath = path.join(PROJECTS_DIR, repoName);

  try {
    await fs.ensureDir(repoPath);
    for (const [fPath, content] of Object.entries(files)) {
      const full = path.join(repoPath, fPath);
      await fs.ensureDir(path.dirname(full));
      await fs.writeFile(full, content);
    }

    const git = simpleGit(repoPath);
    if (!(await git.checkIsRepo())) await git.init();

    await git.addConfig('user.email', 'zicon-ide@bot.com');
    await git.addConfig('user.name', 'Zicon IDE');

    const cleanUrl = repoUrl.replace(/^https?:\/\//, '');
    const authUrl = `https://${token}@${cleanUrl}`;

    await git.add('.');
    const msg = (commitMessage && commitMessage.trim()) || `Zicon Sync: ${new Date().toLocaleString()}`;
    await git.commit(msg);

    let branch = 'main';
    try { await git.push(authUrl, 'main'); }
    catch (e) { branch = 'master'; await git.push(authUrl, 'master'); }

    res.json({ success: true, commitMessage: msg, branch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 4. WEB3 PAYMENT VERIFICATION ──
app.post('/api/verify-payment', async (req, res) => {
  const { txHash, address, extensionId } = req.body;

  if (!txHash || !address || !extensionId) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Find the extension
  const ext = EXTENSION_CATALOG.find(e => e.id === extensionId);
  if (!ext) {
    return res.status(400).json({ success: false, message: "Unknown extension" });
  }

  const grantAndRespond = (status, extra = {}) => {
    const key = address.toLowerCase();
    if (!purchasedExtensions[key]) purchasedExtensions[key] = [];
    if (!purchasedExtensions[key].includes(extensionId)) {
      purchasedExtensions[key].push(extensionId);
      savePurchases(purchasedExtensions);
    }
    console.log(`✅ Extension "${extensionId}" granted to ${address} (${status}) — tx: ${txHash}`);
    res.json({ success: true, extensionId, txHash, ...extra });
  };

  // Sepolia RPCs to try — staticNetwork avoids repeated network-detection calls
  const SEPOLIA_NETWORK = ethers.Network.from(11155111);
  const RPCS = [
    "https://rpc.ankr.com/eth_sepolia",
    "https://rpc.sepolia.org",
    "https://ethereum-sepolia-rpc.publicnode.com",
  ];

  let tx = null;

  for (const rpc of RPCS) {
    let provider = null;
    try {
      provider = new ethers.JsonRpcProvider(rpc, SEPOLIA_NETWORK, { staticNetwork: SEPOLIA_NETWORK });
      // Quick retries — 3 attempts, 1.5s apart, per RPC
      for (let i = 0; i < 3; i++) {
        tx = await provider.getTransaction(txHash);
        if (tx) break;
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch {
      // try next RPC
    } finally {
      // CRITICAL: stop background polling, or this provider retries forever
      provider?.destroy();
    }
    if (tx) break;
  }

  // Not found on-chain via any RPC — trust the frontend's confirmed tx
  if (!tx) {
    console.log(`⚠️ TX not found via RPC but trusting frontend confirmation: ${txHash}`);
    return grantAndRespond("rpc-not-found");
  }

  // Validate sender matches
  if (tx.from?.toLowerCase() !== address.toLowerCase()) {
    return res.status(400).json({ success: false, message: "Sender mismatch" });
  }

  return grantAndRespond("verified");
});

// ── 5. SOLIDITY AUDIT ──
app.post('/api/audit-solidity', async (req, res) => {
  const { address, signature, message, content, aiKey, geminiKey } = req.body;
  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ success: false, message: "Invalid signature." });
    }

    const auditPrompt = `You are an expert Solidity smart contract security auditor. Analyze this contract for vulnerabilities, gas issues, and best practice violations.

Respond ONLY with a JSON object, no markdown, no explanation outside the JSON:
{
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|CLEAR",
  "summary": "One sentence assessment",
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "title": "Short title",
      "description": "What the issue is",
      "recommendation": "How to fix it"
    }
  ]
}

Contract to audit:
${content}`;

    // 1. Try Anthropic if key provided — fall through to Gemini on any error
    if (aiKey && aiKey.startsWith('sk-ant-')) {
      try {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          { model: 'claude-sonnet-4-6', max_tokens: 2048, messages: [{ role: 'user', content: auditPrompt }] },
          { headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } }
        );
        const text = response.data.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return res.json({ success: true, aiAudit: JSON.parse(jsonMatch[0]), engine: 'Claude' });
      } catch (claudeErr) {
        console.log('Claude unavailable, falling through to Gemini:', claudeErr.response?.data?.error?.message || claudeErr.message);
        // Fall through to Gemini below
      }
    }

    // 2. Try Groq (completely free, no billing needed)
    if (geminiKey && geminiKey.startsWith('gsk_')) {
      console.log('Trying Groq audit with key:', geminiKey.slice(0, 8) + '...');
      try {
        const groqRes = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: auditPrompt }],
            temperature: 0.1,
            max_tokens: 2048,
          },
          { headers: { 'Authorization': `Bearer ${geminiKey}`, 'content-type': 'application/json' } }
        );
        const text = groqRes.data.choices[0].message.content;
        console.log('Groq response received, length:', text.length);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return res.json({ success: true, aiAudit: JSON.parse(jsonMatch[0]), engine: 'Groq (Llama3)' });
        return res.json({ success: true, aiAudit: { severity: 'CLEAR', summary: text, findings: [] }, engine: 'Groq (Llama3)' });
      } catch (groqErr) {
        const groqError = groqErr.response?.data?.error?.message || groqErr.message;
        console.error('Groq error:', groqError);
        return res.json({ success: true, reports: [`⚠️ Groq error: ${groqError}`], engine: 'error' });
      }
    } else {
      console.log('No Groq key provided. geminiKey value:', geminiKey ? `"${geminiKey.slice(0,8)}..."` : 'empty');
    }

    // 3. Try Gemini if key looks like a Gemini key
    if (geminiKey && !geminiKey.startsWith('gsk_')) {
      try {
        const geminiRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            contents: [{ parts: [{ text: auditPrompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
          },
          { headers: { 'content-type': 'application/json' } }
        );
        const text = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return res.json({ success: true, aiAudit: JSON.parse(jsonMatch[0]), engine: 'Gemini' });
      } catch (geminiErr) {
        const geminiError = geminiErr.response?.data?.error?.message || geminiErr.message;
        console.error('Gemini error:', geminiError);
      }
    }

    // 3. Fallback: basic static analysis
    const reports = [];
    if (content.includes("selfdestruct")) reports.push("🚨 CRITICAL: selfdestruct found — can destroy contract.");
    if (content.includes("tx.origin")) reports.push("⚠️ HIGH: tx.origin detected — use msg.sender instead.");
    if (content.includes("delegatecall")) reports.push("🚨 HIGH: delegatecall found — verify context carefully.");
    if (!content.includes("ReentrancyGuard") && content.includes("transfer")) reports.push("ℹ️ Suggestion: Consider ReentrancyGuard for transfer functions.");
    if (content.includes("block.timestamp")) reports.push("⚠️ LOW: block.timestamp can be manipulated by miners.");
    if (!content.includes("emit")) reports.push("ℹ️ INFO: No events emitted — consider adding events for state changes.");
    res.json({ success: true, reports: reports.length ? reports : ["✅ No obvious issues found (basic scan — add a Gemini key for free AI audit)"], engine: 'basic' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 6. CARBON ENGINE ──
app.post('/api/initialize-carbon', async (req, res) => {
  const { walletAddress, projectName } = req.body;
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const templatePath = path.join(TEMPLATES_DIR, 'carbon');

  try {
    await fs.ensureDir(projectPath);
    if (await fs.pathExists(templatePath)) {
      await fs.copy(templatePath, projectPath);
      const readmePath = path.join(projectPath, 'README.md');
      await fs.writeFile(readmePath, `# ${projectName}\nInjected by Zicon Carbon Engine\nOwner: ${walletAddress}`);
      const files = readDirectoryRecursive(projectPath, projectPath);
      res.json({ success: true, files });
    } else {
      res.status(404).json({ success: false, error: "Carbon template not found on server." });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 7. WORKSPACE LOADER ──
app.get('/api/files', async (req, res) => {
  try {
    if (await fs.pathExists(PROJECTS_DIR)) {
      const files = readDirectoryRecursive(PROJECTS_DIR, PROJECTS_DIR);
      res.json(files);
    } else { res.json({}); }
  } catch (err) { res.status(500).json({ error: "Failed to load workspace" }); }
});

// ── 8. DELETE FILE OR FOLDER ──
app.post('/api/delete', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ success: false, message: "No path" });
  const fullPath = path.join(PROJECTS_DIR, filePath);
  try {
    await fs.remove(fullPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 9. MOVE OR RENAME ──
app.post('/api/move', async (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ success: false, message: "Missing paths" });

  const fullOldPath = path.join(PROJECTS_DIR, oldPath);
  const fullNewPath = path.join(PROJECTS_DIR, newPath);

  try {
    if (!(await fs.pathExists(fullOldPath))) {
      return res.status(404).json({ success: false, error: "Original file not found" });
    }
    await fs.ensureDir(path.dirname(fullNewPath));
    await fs.move(fullOldPath, fullNewPath, { overwrite: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DOCKER: LAUNCH EXTENSION ──
app.post('/api/extensions/launch/:id', async (req, res) => {
  const { id } = req.params;
  const config = COMPOSE_CONFIGS[id];

  if (!config) {
    return res.status(404).json({ success: false, message: "No compose config for this extension" });
  }

  // Write compose file to disk
  const composeFile = path.join(COMPOSE_DIR, `${id}-compose.yml`);
  await fs.writeFile(composeFile, config.compose);

  // If already running, return the URL
  if (runningServices[id]) {
    return res.json({ success: true, url: config.url, status: "already_running" });
  }

  try {
    console.log(`🐳 Launching ${id}...`);

    // Use SSE to stream logs back — but first send the URL immediately
    res.json({ success: true, url: config.url, status: "starting" });

    // Run docker compose up in background
    const proc = spawn("docker", ["compose", "-f", composeFile, "-p", `zicon-${id}`, "up", "-d"], {
      cwd: __dirname,
    });

    runningServices[id] = { pid: proc.pid, url: config.url, startedAt: new Date().toISOString() };

    proc.stdout.on("data", (data) => console.log(`[${id}] ${data}`));
    proc.stderr.on("data", (data) => console.log(`[${id}] ${data}`));
    proc.on("close", (code) => {
      console.log(`[${id}] docker compose exited with code ${code}`);
      if (code !== 0) delete runningServices[id];
    });

  } catch (err) {
    delete runningServices[id];
    console.error(`Launch error for ${id}:`, err.message);
  }
});

// ── DOCKER: STOP EXTENSION ──
app.post('/api/extensions/stop/:id', async (req, res) => {
  const { id } = req.params;
  const composeFile = path.join(COMPOSE_DIR, `${id}-compose.yml`);

  try {
    if (!await fs.pathExists(composeFile)) {
      return res.status(404).json({ success: false, message: "Compose file not found" });
    }

    const proc = spawn("docker", ["compose", "-f", composeFile, "-p", `zicon-${id}`, "down"], {
      cwd: __dirname,
    });

    proc.on("close", () => {
      delete runningServices[id];
      console.log(`🛑 Stopped ${id}`);
    });

    res.json({ success: true, message: `Stopping ${id}...` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DOCKER: STATUS OF ALL SERVICES ──
app.get('/api/extensions/status', (req, res) => {
  res.json({ success: true, running: runningServices });
});

// ── DOCKER: STATUS OF ONE SERVICE ──
app.get('/api/extensions/status/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = execSync(
      `docker ps --filter "name=zicon-${id}" --format "{{.Names}}"`,
      { cwd: __dirname, encoding: "utf8" }
    ).trim();
    const isRunning = result.length > 0;
    res.json({
      success: true,
      status: isRunning ? "running" : "stopped",
      url: COMPOSE_CONFIGS[id]?.url,
    });
  } catch {
    res.json({ success: true, status: "stopped", url: COMPOSE_CONFIGS[id]?.url });
  }
});

app.listen(5000, () => console.log(`🚀 Zicon Backend running at http://localhost:5000`));
