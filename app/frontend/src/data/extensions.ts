export interface Extension {
  id: string;
  name: string;
  description: string;
  price: string;
  category: "container" | "frontend" | "backend" | "database" | "devops" | "web3" | "messaging" | "storage" | "network" | "cms" | "ai";
  icon: string;
  color: string;
  dockerImage?: string;
  composeSnippet?: string;
  tags: string[];
  /** How this extension launches once purchased:
   * - "docker" (default): runs via docker compose on the backend — best for
   *   infrastructure that needs isolation/persistence (databases, CMS, proxies)
   * - "webcontainer": runs natively inside the IDE's WebContainer — best for
   *   Node.js-native tools that operate on your current project's files
   * - "terminal": sends an install/run command into the IDE's WebContainer terminal
   * - "external": opens the tool's website/download page in a new tab
   */
  runtimeType?: "docker" | "webcontainer" | "terminal" | "external";
  /** For runtimeType "webcontainer" — command run directly in the IDE's WebContainer */
  webcontainerCommand?: string;
  /** For runtimeType "terminal" — command sent to the WebContainer shell */
  terminalCommand?: string;
  /** For runtimeType "terminal" — shown to the user after the command runs */
  terminalInstructions?: string;
  /** For runtimeType "external" — URL opened in a new tab */
  externalUrl?: string;
}

export const EXTENSIONS: Extension[] = [

  // ── DEVOPS ──
  { id: "portainer", name: "Portainer", description: "Docker container management UI. Manage all containers, images, networks and volumes visually.", price: "0.001", category: "devops", icon: "🐳", color: "#13BEF9", dockerImage: "portainer/portainer-ce", tags: ["docker", "containers", "management"], composeSnippet: `  portainer:\n    image: portainer/portainer-ce:latest\n    ports:\n      - "9000:9000"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n      - portainer_data:/data\n    restart: always` },
  { id: "traefik", name: "Traefik", description: "Modern cloud-native reverse proxy with automatic SSL, Let's Encrypt, and service discovery.", price: "0.001", category: "devops", icon: "🔀", color: "#24A1C1", dockerImage: "traefik:v3.0", tags: ["proxy", "ssl", "routing"], composeSnippet: `  traefik:\n    image: traefik:v3.0\n    command:\n      - "--api.insecure=true"\n      - "--providers.docker=true"\n    ports:\n      - "80:80"\n      - "8082:8080"\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock` },
  { id: "grafana", name: "Grafana", description: "Beautiful observability dashboards. Monitor metrics, logs, and traces in real time.", price: "0.001", category: "devops", icon: "📊", color: "#F46800", dockerImage: "grafana/grafana", tags: ["monitoring", "dashboards", "metrics"], composeSnippet: `  grafana:\n    image: grafana/grafana:latest\n    ports:\n      - "3001:3000"\n    environment:\n      - GF_SECURITY_ADMIN_PASSWORD=admin\n    volumes:\n      - grafana_data:/var/lib/grafana` },
  { id: "prometheus", name: "Prometheus", description: "Open-source monitoring and alerting toolkit. Scrape metrics from your services automatically.", price: "0.001", category: "devops", icon: "🔥", color: "#E6522C", dockerImage: "prom/prometheus", tags: ["monitoring", "metrics", "alerting"], composeSnippet: `  prometheus:\n    image: prom/prometheus:latest\n    ports:\n      - "9090:9090"\n    volumes:\n      - prometheus_data:/prometheus\n    restart: always` },
  { id: "jenkins", name: "Jenkins", description: "Leading open-source CI/CD automation server. Build, test, and deploy projects continuously.", price: "0.002", category: "devops", icon: "🏗️", color: "#D33833", dockerImage: "jenkins/jenkins:lts", tags: ["ci-cd", "automation", "build"], composeSnippet: `  jenkins:\n    image: jenkins/jenkins:lts\n    ports:\n      - "8084:8080"\n      - "50000:50000"\n    volumes:\n      - jenkins_data:/var/jenkins_home\n    restart: always` },
  { id: "sonarqube", name: "SonarQube", description: "Code quality and security analysis. Detect bugs, vulnerabilities, and code smells automatically.", price: "0.002", category: "devops", icon: "🔍", color: "#4E9BCD", dockerImage: "sonarqube:community", tags: ["code-quality", "security", "analysis"], composeSnippet: `  sonarqube:\n    image: sonarqube:community\n    ports:\n      - "9001:9000"\n    volumes:\n      - sonarqube_data:/opt/sonarqube/data` },
  { id: "gitea", name: "Gitea", description: "Lightweight self-hosted Git service. Your own private GitHub running locally.", price: "0.001", category: "devops", icon: "🍵", color: "#609926", dockerImage: "gitea/gitea", tags: ["git", "repos", "self-hosted"], composeSnippet: `  gitea:\n    image: gitea/gitea:latest\n    ports:\n      - "3003:3000"\n      - "222:22"\n    volumes:\n      - gitea_data:/data\n    restart: always` },
  { id: "drone", name: "Drone CI", description: "Self-hosted CI/CD platform built on Docker. Automate builds with simple YAML pipelines.", price: "0.002", category: "devops", icon: "🚀", color: "#212121", dockerImage: "drone/drone", tags: ["ci-cd", "drone", "automation"], composeSnippet: `  drone:\n    image: drone/drone:2\n    ports:\n      - "8086:80"\n    environment:\n      - DRONE_GITEA_SERVER=http://localhost:3003\n      - DRONE_RPC_SECRET=secret\n      - DRONE_SERVER_HOST=localhost:8086\n    volumes:\n      - drone_data:/data\n    restart: always` },
  { id: "loki", name: "Loki + Promtail", description: "Grafana's log aggregation system. Collect, store, and query logs from all your containers.", price: "0.001", category: "devops", icon: "📋", color: "#F0A14A", dockerImage: "grafana/loki", tags: ["logging", "loki", "observability"], composeSnippet: `  loki:\n    image: grafana/loki:latest\n    ports:\n      - "3100:3100"\n    restart: always\n  promtail:\n    image: grafana/promtail:latest\n    volumes:\n      - /var/log:/var/log\n      - /var/run/docker.sock:/var/run/docker.sock\n    restart: always` },

  // ── FRONTEND ──
  { id: "react-app", name: "React + Vite", description: "Scaffolds and runs a React + Vite app directly in your IDE's WebContainer. No Docker, no image pulls — instant dev server with hot reload.", price: "0.0005", category: "frontend", icon: "⚛️", color: "#61DAFB", tags: ["react", "vite", "frontend", "typescript"], runtimeType: "webcontainer", webcontainerCommand: "npm create vite@latest demo-react -- --template react && cd demo-react && npm install && npm run dev -- --host" },
  { id: "nextjs", name: "Next.js", description: "Scaffolds and runs a Next.js app directly in your IDE's WebContainer. Full-stack React with SSR — no Docker needed.", price: "0.001", category: "frontend", icon: "▲", color: "#FFFFFF", tags: ["nextjs", "react", "ssr", "fullstack"], runtimeType: "webcontainer", webcontainerCommand: "npx create-next-app@latest demo-next && cd demo-next && npm run dev" },
  { id: "angular-nginx", name: "Angular", description: "Scaffolds and runs an Angular app directly in your IDE's WebContainer via the Angular CLI. No Docker needed (first run installs Angular CLI — may take a minute).", price: "0.001", category: "frontend", icon: "🅰️", color: "#DD0031", tags: ["angular", "frontend"], runtimeType: "webcontainer", webcontainerCommand: "npx @angular/cli@latest new demo-angular && cd demo-angular && npm start -- --host 0.0.0.0" },
  { id: "vue-nginx", name: "Vue 3", description: "Scaffolds and runs a Vue 3 app directly in your IDE's WebContainer. Hot reload, no Docker needed.", price: "0.001", category: "frontend", icon: "💚", color: "#4FC08D", tags: ["vue", "frontend"], runtimeType: "webcontainer", webcontainerCommand: "npm create vue@latest demo-vue && cd demo-vue && npm install && npm run dev -- --host" },
  { id: "svelte", name: "SvelteKit", description: "Scaffolds and runs a SvelteKit app directly in your IDE's WebContainer. Blazing fast, no Docker needed.", price: "0.001", category: "frontend", icon: "🔶", color: "#FF3E00", tags: ["svelte", "sveltekit", "frontend"], runtimeType: "webcontainer", webcontainerCommand: "npx sv create demo-svelte && cd demo-svelte && npm install && npm run dev -- --host" },

  // ── BACKEND ──
  { id: "nginx", name: "Nginx", description: "High-performance reverse proxy and web server. Route traffic to your services with ease.", price: "0.0005", category: "backend", icon: "⚡", color: "#009639", dockerImage: "nginx:alpine", tags: ["proxy", "server", "load-balancer"], composeSnippet: `  nginx:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n    restart: always` },
  { id: "tomcat", name: "Apache Tomcat", description: "Java servlet container and web server. Deploy WAR files and run Java EE applications.", price: "0.001", category: "backend", icon: "🐱", color: "#F8DC75", dockerImage: "tomcat:10", tags: ["tomcat", "java", "servlet", "web-server"], composeSnippet: `  tomcat:\n    image: tomcat:10-jdk17\n    ports:\n      - "8086:8080"\n    volumes:\n      - tomcat_webapps:/usr/local/tomcat/webapps\n    restart: always` },
  { id: "httpd", name: "Apache HTTPD", description: "The world's most widely used web server. Serve static sites or proxy to backend apps.", price: "0.0005", category: "backend", icon: "🪶", color: "#D22128", dockerImage: "httpd:alpine", tags: ["apache", "httpd", "web-server"], composeSnippet: `  httpd:\n    image: httpd:alpine\n    ports:\n      - "8087:80"\n    volumes:\n      - ./htdocs:/usr/local/apache2/htdocs\n    restart: always` },
  { id: "jboss", name: "JBoss / WildFly", description: "Enterprise Java application server. Run Jakarta EE apps with full management console.", price: "0.002", category: "backend", icon: "☕", color: "#EC7A08", dockerImage: "quay.io/wildfly/wildfly", tags: ["jboss", "wildfly", "java", "enterprise"], composeSnippet: `  wildfly:\n    image: quay.io/wildfly/wildfly:latest\n    ports:\n      - "8088:8080"\n      - "9990:9990"\n    command: /opt/jboss/wildfly/bin/standalone.sh -b 0.0.0.0 -bmanagement 0.0.0.0\n    restart: always` },
  { id: "flask-redis", name: "Flask + Redis", description: "Python Flask web app with Redis caching. Perfect for REST APIs with session management.", price: "0.001", category: "backend", icon: "🐍", color: "#3776AB", dockerImage: "python:3.11-alpine", tags: ["python", "flask", "redis", "api"], composeSnippet: `  flask:\n    build: .\n    ports:\n      - "5001:5000"\n    environment:\n      - REDIS_URL=redis://redis:6379\n    depends_on:\n      - redis\n  redis:\n    image: redis:alpine` },
  { id: "django-postgres", name: "Django + PostgreSQL", description: "Django web framework with PostgreSQL. Batteries-included Python web development.", price: "0.001", category: "backend", icon: "🎸", color: "#0C4B33", dockerImage: "python:3.11", tags: ["python", "django", "postgres"], composeSnippet: `  django:\n    build: .\n    ports:\n      - "8000:8000"\n    depends_on:\n      - postgres\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret` },
  { id: "fastapi", name: "FastAPI + PostgreSQL", description: "High-performance Python API framework with automatic OpenAPI docs and PostgreSQL.", price: "0.001", category: "backend", icon: "⚡", color: "#009688", dockerImage: "python:3.11", tags: ["python", "fastapi", "api", "openapi"], composeSnippet: `  fastapi:\n    image: python:3.11\n    working_dir: /app\n    ports:\n      - "8001:8000"\n    command: sh -c "pip install fastapi uvicorn && uvicorn main:app --host 0.0.0.0 --reload"\n    volumes:\n      - .:/app` },
  { id: "express-mongo", name: "Express + MongoDB", description: "Node.js Express REST API with MongoDB. Classic MERN stack backend setup.", price: "0.001", category: "backend", icon: "🟩", color: "#68A063", dockerImage: "node:20-alpine", tags: ["nodejs", "express", "mongodb", "api"], composeSnippet: `  express:\n    image: node:20-alpine\n    working_dir: /app\n    ports:\n      - "3004:3000"\n    command: sh -c "npm install && node index.js"\n    depends_on:\n      - mongodb\n  mongodb:\n    image: mongo:7\n    ports:\n      - "27017:27017"` },
  { id: "aspnet-mssql", name: "ASP.NET + MSSQL", description: "Microsoft ASP.NET Core with SQL Server. Enterprise-grade .NET web development stack.", price: "0.002", category: "backend", icon: "🪟", color: "#512BD4", dockerImage: "mcr.microsoft.com/dotnet/aspnet", tags: ["dotnet", "csharp", "mssql", "microsoft"], composeSnippet: `  aspnet:\n    image: mcr.microsoft.com/dotnet/aspnet:8.0\n    ports:\n      - "8002:80"\n    depends_on:\n      - mssql\n  mssql:\n    image: mcr.microsoft.com/mssql/server:2022-latest\n    environment:\n      SA_PASSWORD: "Secret123!"\n      ACCEPT_EULA: "Y"\n    ports:\n      - "1433:1433"` },
  { id: "nginx-flask-mysql", name: "Nginx + Flask + MySQL", description: "Full production stack: Nginx reverse proxy, Flask app, MySQL database all wired together.", price: "0.001", category: "backend", icon: "🔗", color: "#3776AB", dockerImage: "nginx:alpine", tags: ["nginx", "flask", "mysql", "stack"], composeSnippet: `  nginx:\n    image: nginx:alpine\n    ports:\n      - "8088:80"\n    depends_on:\n      - flask\n  flask:\n    image: python:3.11-alpine\n    working_dir: /app\n    command: sh -c "pip install flask mysql-connector-python && python app.py"\n  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: appdb` },
  { id: "flask", name: "Flask", description: "Lightweight Python web framework. Minimal, flexible, perfect for APIs and small web apps.", price: "0.0005", category: "backend", icon: "🧪", color: "#3776AB", dockerImage: "python:3.11-alpine", tags: ["python", "flask", "api", "web"], composeSnippet: `  flask:\n    image: python:3.11-alpine\n    working_dir: /app\n    ports:\n      - "5002:5000"\n    command: sh -c "pip install flask && python app.py"\n    volumes:\n      - .:/app` },
  { id: "nodejs", name: "Node.js", description: "Scaffolds and runs a minimal Express server directly in your IDE's WebContainer. No Docker needed — instant.", price: "0.0005", category: "backend", icon: "🟢", color: "#339933", tags: ["nodejs", "javascript", "express", "runtime"], runtimeType: "webcontainer", webcontainerCommand: "mkdir -p demo-node && cd demo-node && npm init -y && npm install express && printf \"const express=require('express');\\nconst app=express();\\napp.get('/',(req,res)=>res.send('Hello from Zicon Node Extension! 🟢'));\\napp.listen(3000,()=>console.log('Server running on port 3000'));\\n\" > index.js && node index.js" },
  { id: "dotnet", name: ".NET", description: "Standalone .NET runtime container. Run ASP.NET Core APIs, console apps, or worker services.", price: "0.001", category: "backend", icon: "🟣", color: "#512BD4", dockerImage: "mcr.microsoft.com/dotnet/sdk", tags: ["dotnet", "csharp", "microsoft", "api"], composeSnippet: `  dotnet:\n    image: mcr.microsoft.com/dotnet/sdk:8.0\n    working_dir: /app\n    ports:\n      - "8003:8080"\n    command: sh -c "dotnet run"\n    volumes:\n      - .:/app` },
  { id: "rails", name: "Ruby on Rails", description: "Convention-over-configuration Ruby web framework with PostgreSQL. Build apps fast.", price: "0.001", category: "backend", icon: "💎", color: "#CC0000", dockerImage: "ruby:3.3", tags: ["ruby", "rails", "postgres", "web"], composeSnippet: `  rails:\n    image: ruby:3.3\n    working_dir: /app\n    ports:\n      - "3006:3000"\n    command: sh -c "gem install rails && bundle install && rails server -b 0.0.0.0"\n    depends_on:\n      - postgres\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret` },
  { id: "springboot", name: "Spring Boot", description: "Java's most popular framework for production-grade microservices with PostgreSQL.", price: "0.001", category: "backend", icon: "🍃", color: "#6DB33F", dockerImage: "eclipse-temurin:21-jdk", tags: ["java", "spring", "springboot", "microservices"], composeSnippet: `  springboot:\n    image: eclipse-temurin:21-jdk\n    working_dir: /app\n    ports:\n      - "8004:8080"\n    command: sh -c "./mvnw spring-boot:run"\n    volumes:\n      - .:/app\n    depends_on:\n      - postgres\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret` },
  { id: "spark", name: "Apache Spark", description: "Distributed big-data processing engine with Spark UI. Run analytics jobs at scale.", price: "0.002", category: "backend", icon: "✨", color: "#E25A1C", dockerImage: "apache/spark", tags: ["spark", "bigdata", "analytics", "java"], composeSnippet: `  spark-master:\n    image: apache/spark:latest\n    command: /opt/spark/bin/spark-class org.apache.spark.deploy.master.Master\n    ports:\n      - "8005:8080"\n      - "7077:7077"\n  spark-worker:\n    image: apache/spark:latest\n    command: /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker spark://spark-master:7077\n    depends_on:\n      - spark-master` },

  // ── DATABASE ──
  { id: "postgres", name: "PostgreSQL + pgAdmin", description: "Production-grade relational database with pgAdmin web UI for visual management.", price: "0.001", category: "database", icon: "🐘", color: "#336791", dockerImage: "postgres:16-alpine", tags: ["database", "sql", "postgres"], composeSnippet: `  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_USER: admin\n      POSTGRES_PASSWORD: secret\n      POSTGRES_DB: appdb\n    ports:\n      - "5432:5432"\n    volumes:\n      - postgres_data:/var/lib/postgresql/data` },
  { id: "mongodb", name: "MongoDB + Mongo Express", description: "Document-oriented NoSQL database with Mongo Express web UI for easy data management.", price: "0.001", category: "database", icon: "🍃", color: "#4DB33D", dockerImage: "mongo:7", tags: ["nosql", "mongodb", "database"], composeSnippet: `  mongodb:\n    image: mongo:7\n    environment:\n      MONGO_INITDB_ROOT_USERNAME: admin\n      MONGO_INITDB_ROOT_PASSWORD: secret\n    ports:\n      - "27017:27017"\n    volumes:\n      - mongo_data:/data/db` },
  { id: "redis", name: "Redis + Commander", description: "In-memory data store with Redis Commander UI. Blazing fast caching, sessions, pub/sub.", price: "0.0005", category: "database", icon: "🔴", color: "#DC382D", dockerImage: "redis:alpine", tags: ["cache", "redis", "session"], composeSnippet: `  redis:\n    image: redis:alpine\n    ports:\n      - "6379:6379"\n    command: redis-server --appendonly yes\n    volumes:\n      - redis_data:/data` },
  { id: "mysql", name: "MySQL + phpMyAdmin", description: "World's most popular open-source relational database with phpMyAdmin web interface.", price: "0.001", category: "database", icon: "🐬", color: "#4479A1", dockerImage: "mysql:8", tags: ["database", "sql", "mysql"], composeSnippet: `  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: appdb\n    ports:\n      - "3306:3306"\n    volumes:\n      - mysql_data:/var/lib/mysql` },
  { id: "mariadb", name: "MariaDB + phpMyAdmin", description: "Community-developed fork of MySQL. Drop-in replacement with extra storage engines, plus phpMyAdmin UI.", price: "0.001", category: "database", icon: "🦭", color: "#003545", dockerImage: "mariadb:11", tags: ["database", "sql", "mariadb"], composeSnippet: `  mariadb:\n    image: mariadb:11\n    environment:\n      MARIADB_ROOT_PASSWORD: secret\n      MARIADB_DATABASE: appdb\n    ports:\n      - "3307:3306"\n    volumes:\n      - mariadb_data:/var/lib/mysql` },
  { id: "mssql", name: "MSSQL Server", description: "Microsoft SQL Server with Adminer web UI for visual database management.", price: "0.002", category: "database", icon: "🪟", color: "#CC2927", dockerImage: "mcr.microsoft.com/mssql/server", tags: ["database", "sql", "mssql", "microsoft"], composeSnippet: `  mssql:\n    image: mcr.microsoft.com/mssql/server:2022-latest\n    environment:\n      SA_PASSWORD: "Secret123!"\n      ACCEPT_EULA: "Y"\n    ports:\n      - "1433:1433"\n    volumes:\n      - mssql_data:/var/opt/mssql` },
  { id: "elasticsearch", name: "Elasticsearch + Kibana", description: "Powerful search and analytics engine with Kibana visualization dashboard.", price: "0.002", category: "database", icon: "🔎", color: "#FEC514", dockerImage: "elasticsearch:8.11.0", tags: ["search", "elasticsearch", "kibana"], composeSnippet: `  elasticsearch:\n    image: elasticsearch:8.11.0\n    environment:\n      - discovery.type=single-node\n      - xpack.security.enabled=false\n    ports:\n      - "9200:9200"` },
  { id: "influxdb", name: "InfluxDB", description: "Purpose-built time series database for metrics, events, and real-time analytics.", price: "0.001", category: "database", icon: "📈", color: "#22ADF6", dockerImage: "influxdb:2", tags: ["timeseries", "metrics", "influxdb"], composeSnippet: `  influxdb:\n    image: influxdb:2\n    ports:\n      - "8086:8086"\n    environment:\n      - DOCKER_INFLUXDB_INIT_MODE=setup\n      - DOCKER_INFLUXDB_INIT_USERNAME=admin\n      - DOCKER_INFLUXDB_INIT_PASSWORD=secret123\n    volumes:\n      - influxdb_data:/var/lib/influxdb2` },
  { id: "couchdb", name: "CouchDB", description: "Apache CouchDB document database with built-in Fauxton web UI and REST API.", price: "0.001", category: "database", icon: "🛋️", color: "#E42528", dockerImage: "couchdb", tags: ["nosql", "couchdb", "rest-api"], composeSnippet: `  couchdb:\n    image: couchdb:latest\n    ports:\n      - "5984:5984"\n    environment:\n      COUCHDB_USER: admin\n      COUCHDB_PASSWORD: secret\n    volumes:\n      - couchdb_data:/opt/couchdb/data` },
  { id: "neo4j", name: "Neo4j", description: "Graph database with browser UI. Model, store and query highly connected data.", price: "0.002", category: "database", icon: "🕸️", color: "#008CC1", dockerImage: "neo4j", tags: ["graph", "neo4j", "database"], composeSnippet: `  neo4j:\n    image: neo4j:latest\n    ports:\n      - "7474:7474"\n      - "7687:7687"\n    environment:\n      NEO4J_AUTH: neo4j/secret123\n    volumes:\n      - neo4j_data:/data` },
  { id: "adminer", name: "Adminer", description: "Lightweight database management tool. Supports MySQL, PostgreSQL, SQLite and more.", price: "0.0005", category: "database", icon: "🗃️", color: "#D33B22", dockerImage: "adminer", tags: ["database", "admin", "sql"], composeSnippet: `  adminer:\n    image: adminer:latest\n    ports:\n      - "8089:8080"\n    restart: always` },

  // ── CMS ──
  { id: "wordpress", name: "WordPress + MySQL", description: "World's most popular CMS with MySQL database. Full blog and website platform.", price: "0.001", category: "cms", icon: "📝", color: "#21759B", dockerImage: "wordpress", tags: ["wordpress", "cms", "blog", "mysql"], composeSnippet: `  wordpress:\n    image: wordpress:latest\n    ports:\n      - "8090:80"\n    environment:\n      WORDPRESS_DB_HOST: mysql\n      WORDPRESS_DB_USER: admin\n      WORDPRESS_DB_PASSWORD: secret\n      WORDPRESS_DB_NAME: wordpress\n    depends_on:\n      - mysql\n  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: wordpress\n      MYSQL_USER: admin\n      MYSQL_PASSWORD: secret\n    volumes:\n      - wordpress_db:/var/lib/mysql` },
  { id: "ghost", name: "Ghost", description: "Modern publishing platform. Beautiful blogging with built-in SEO, newsletters, and memberships.", price: "0.001", category: "cms", icon: "👻", color: "#738A94", dockerImage: "ghost", tags: ["ghost", "cms", "blog", "publishing"], composeSnippet: `  ghost:\n    image: ghost:latest\n    ports:\n      - "2368:2368"\n    environment:\n      database__client: sqlite3\n      NODE_ENV: development\n    volumes:\n      - ghost_data:/var/lib/ghost/content` },
  { id: "strapi", name: "Strapi CMS", description: "Open-source headless CMS. Build APIs instantly with a customizable admin panel.", price: "0.002", category: "cms", icon: "🎯", color: "#4945FF", dockerImage: "strapi/strapi", tags: ["strapi", "headless-cms", "api"], composeSnippet: `  strapi:\n    image: node:20-alpine\n    working_dir: /app\n    ports:\n      - "1337:1337"\n    command: sh -c "npx create-strapi-app@latest app --quickstart"\n    volumes:\n      - strapi_data:/app` },

  // ── MESSAGING ──
  { id: "rabbitmq", name: "RabbitMQ", description: "Reliable message broker with management UI. Queue, route, and process messages between services.", price: "0.001", category: "messaging", icon: "🐰", color: "#FF6600", dockerImage: "rabbitmq:3-management", tags: ["messaging", "queue", "amqp"], composeSnippet: `  rabbitmq:\n    image: rabbitmq:3-management\n    ports:\n      - "5672:5672"\n      - "15672:15672"\n    environment:\n      RABBITMQ_DEFAULT_USER: admin\n      RABBITMQ_DEFAULT_PASS: secret\n    volumes:\n      - rabbitmq_data:/var/lib/rabbitmq` },
  { id: "kafka", name: "Kafka + Zookeeper", description: "Distributed event streaming platform. Handle millions of events per second.", price: "0.002", category: "messaging", icon: "📨", color: "#231F20", dockerImage: "confluentinc/cp-kafka", tags: ["kafka", "streaming", "events"], composeSnippet: `  zookeeper:\n    image: confluentinc/cp-zookeeper:latest\n    environment:\n      ZOOKEEPER_CLIENT_PORT: 2181\n  kafka:\n    image: confluentinc/cp-kafka:latest\n    ports:\n      - "9092:9092"\n    environment:\n      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181\n      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092\n    depends_on:\n      - zookeeper` },
  { id: "nats", name: "NATS", description: "Lightweight, high-performance messaging system. Cloud-native pub/sub and queuing.", price: "0.001", category: "messaging", icon: "💬", color: "#27AAE1", dockerImage: "nats", tags: ["nats", "messaging", "pubsub"], composeSnippet: `  nats:\n    image: nats:latest\n    ports:\n      - "4222:4222"\n      - "8222:8222"\n    command: --http_port 8222\n    restart: always` },

  // ── STORAGE ──
  { id: "minio", name: "MinIO", description: "S3-compatible object storage. Store files, images, backups with an AWS S3-like API.", price: "0.001", category: "storage", icon: "🗄️", color: "#C72E49", dockerImage: "minio/minio", tags: ["storage", "s3", "files"], composeSnippet: `  minio:\n    image: minio/minio\n    ports:\n      - "9002:9000"\n      - "9003:9001"\n    environment:\n      MINIO_ROOT_USER: admin\n      MINIO_ROOT_PASSWORD: secret123\n    command: server /data --console-address ":9001"\n    volumes:\n      - minio_data:/data` },
  { id: "nextcloud", name: "Nextcloud", description: "Self-hosted cloud storage and collaboration. Your own private Dropbox + Google Docs.", price: "0.002", category: "storage", icon: "☁️", color: "#0082C9", dockerImage: "nextcloud", tags: ["nextcloud", "cloud", "storage", "collaboration"], composeSnippet: `  nextcloud:\n    image: nextcloud:latest\n    ports:\n      - "8091:80"\n    environment:\n      MYSQL_HOST: mysql\n      MYSQL_DATABASE: nextcloud\n      MYSQL_USER: admin\n      MYSQL_PASSWORD: secret\n    volumes:\n      - nextcloud_data:/var/www/html\n    depends_on:\n      - mysql\n  mysql:\n    image: mysql:8\n    environment:\n      MYSQL_ROOT_PASSWORD: secret\n      MYSQL_DATABASE: nextcloud\n      MYSQL_USER: admin\n      MYSQL_PASSWORD: secret` },
  { id: "seafile", name: "Seafile", description: "High-performance file syncing and sharing platform. Reliable self-hosted cloud storage.", price: "0.002", category: "storage", icon: "🌊", color: "#00AAE4", dockerImage: "seafileltd/seafile-mc", tags: ["seafile", "storage", "sync"], composeSnippet: `  seafile:\n    image: seafileltd/seafile-mc:latest\n    ports:\n      - "8092:80"\n    environment:\n      DB_HOST: mysql\n      DB_ROOT_PASSWD: secret\n      SEAFILE_ADMIN_EMAIL: admin@zicon.dev\n      SEAFILE_ADMIN_PASSWORD: secret123\n    volumes:\n      - seafile_data:/shared` },

  // ── NETWORK ──
  { id: "wireguard", name: "WireGuard VPN", description: "Fast, modern, secure VPN tunnel. Simple setup, state-of-the-art cryptography.", price: "0.002", category: "network", icon: "🔒", color: "#88171A", dockerImage: "linuxserver/wireguard", tags: ["vpn", "wireguard", "security", "network"], composeSnippet: `  wireguard:\n    image: linuxserver/wireguard\n    cap_add:\n      - NET_ADMIN\n      - SYS_MODULE\n    environment:\n      - PUID=1000\n      - PGID=1000\n      - SERVERURL=localhost\n      - PEERS=3\n    ports:\n      - "51820:51820/udp"\n    volumes:\n      - wireguard_data:/config\n    sysctls:\n      - net.ipv4.conf.all.src_valid_mark=1\n    restart: always` },
  { id: "pihole", name: "Pi-hole", description: "Network-wide ad blocking via DNS. Block ads and trackers on every device on your network.", price: "0.001", category: "network", icon: "🕳️", color: "#96060C", dockerImage: "pihole/pihole", tags: ["pihole", "dns", "adblock", "network"], composeSnippet: `  pihole:\n    image: pihole/pihole:latest\n    ports:\n      - "53:53/tcp"\n      - "53:53/udp"\n      - "8093:80"\n    environment:\n      TZ: America/New_York\n      WEBPASSWORD: secret\n    volumes:\n      - pihole_data:/etc/pihole\n    restart: always` },
  { id: "nginx-proxy-manager", name: "Nginx Proxy Manager", description: "Easy nginx proxy management with SSL certificates, redirects and access lists via web UI.", price: "0.001", category: "network", icon: "🌐", color: "#F4A629", dockerImage: "jc21/nginx-proxy-manager", tags: ["nginx", "proxy", "ssl", "management"], composeSnippet: `  npm:\n    image: jc21/nginx-proxy-manager:latest\n    ports:\n      - "8094:80"\n      - "8443:443"\n      - "8095:81"\n    volumes:\n      - npm_data:/data\n      - npm_ssl:/etc/letsencrypt\n    restart: always` },

  // ── WEB3 ──
  { id: "web3-auth", name: "Web3 Auth (SIWE)", description: "Installs the official Sign-In with Ethereum library plus ethers.js into your current project. Build wallet-based auth with real, working packages.", price: "0.002", category: "web3", icon: "🦊", color: "#F6851B", tags: ["web3", "metamask", "auth", "ethereum", "siwe"], runtimeType: "terminal", terminalCommand: "npm install siwe ethers", terminalInstructions: "Installed! Import { SiweMessage } from 'siwe' to create and verify Sign-In with Ethereum messages, paired with ethers.js for wallet interaction." },
  { id: "hardhat", name: "Hardhat Node", description: "Local Ethereum development network. Already pre-installed in this IDE — runs natively in your WebContainer, no Docker needed. Deploys against your actual project files.", price: "0.002", category: "web3", icon: "⛏️", color: "#FFF100", tags: ["solidity", "ethereum", "hardhat"], runtimeType: "webcontainer", webcontainerCommand: "npx hardhat node" },
  { id: "ipfs", name: "IPFS Node", description: "InterPlanetary File System node. Decentralized storage and content-addressed files.", price: "0.002", category: "web3", icon: "🌍", color: "#65C2CB", dockerImage: "ipfs/kubo", tags: ["ipfs", "web3", "decentralized", "storage"], composeSnippet: `  ipfs:\n    image: ipfs/kubo:latest\n    ports:\n      - "4001:4001"\n      - "5001:5001"\n      - "8096:8080"\n    volumes:\n      - ipfs_data:/data/ipfs\n    restart: always` },
  { id: "the-graph", name: "The Graph Node", description: "Indexing protocol for querying blockchain data with GraphQL. Essential for dApp development.", price: "0.003", category: "web3", icon: "📊", color: "#6747ED", dockerImage: "graphprotocol/graph-node", tags: ["graphql", "blockchain", "indexing", "web3"], composeSnippet: `  graph-node:\n    image: graphprotocol/graph-node:latest\n    ports:\n      - "8000:8000"\n      - "8001:8001"\n      - "8020:8020"\n    environment:\n      postgres_host: postgres\n      postgres_user: admin\n      postgres_pass: secret\n      postgres_db: graph\n      ipfs: ipfs:5001\n      ethereum: sepolia:https://rpc.ankr.com/eth_sepolia` },

  // ── AI / ML ──
  {
    id: "jupyter",
    name: "Jupyter Notebook",
    description: "Interactive Python notebooks for data science and ML experimentation. Full SciPy stack — numpy, pandas, matplotlib, scikit-learn included.",
    price: "0.001",
    category: "ai",
    icon: "📓",
    color: "#F37626",
    dockerImage: "jupyter/scipy-notebook",
    tags: ["jupyter", "python", "notebook", "data-science", "ml"],
    runtimeType: "docker",
    composeSnippet: `  jupyter:\n    image: jupyter/scipy-notebook:latest\n    ports:\n      - "8888:8888"\n    environment:\n      - JUPYTER_TOKEN=zicon\n    volumes:\n      - jupyter_data:/home/jovyan/work\n    restart: always\nvolumes:\n  jupyter_data:`,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Chat with Claude directly in your Zicon terminal. Pure JS REPL using @anthropic-ai/sdk — no native binaries, works fully in WebContainer.",
    price: "0.002",
    category: "ai",
    icon: "🤖",
    color: "#D97757",
    tags: ["ai", "claude", "anthropic", "cli", "coding-assistant"],
    runtimeType: "terminal",
    terminalCommand: "npm install @anthropic-ai/sdk",
    terminalInstructions: "Once installed, run in the terminal: node claude-repl.cjs sk-ant-YOUR_KEY_HERE",
  },
  {
    id: "cursor-ide",
    name: "Cursor AI IDE",
    description: "AI-first code editor built on VS Code. AI autocomplete, chat, and agent mode. This is a desktop app — opens the download page.",
    price: "0.001",
    category: "ai",
    icon: "✨",
    color: "#000000",
    tags: ["ai", "ide", "cursor", "editor", "desktop"],
    runtimeType: "external",
    externalUrl: "https://cursor.com/downloads",
  },
  {
    id: "notebooklm",
    name: "Google NotebookLM",
    description: "AI research assistant that turns your documents into summaries, podcasts, and study guides. This is a Google cloud product — opens in a new tab.",
    price: "0.0005",
    category: "ai",
    icon: "🔬",
    color: "#4285F4",
    tags: ["ai", "google", "notebooklm", "research", "notes"],
    runtimeType: "external",
    externalUrl: "https://notebooklm.google.com",
  },
];

export const CATEGORIES = [
  { id: "all", label: "All Extensions" },
  { id: "ai", label: "AI / ML" },
  { id: "devops", label: "DevOps" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "database", label: "Database" },
  { id: "cms", label: "CMS" },
  { id: "messaging", label: "Messaging" },
  { id: "storage", label: "Storage" },
  { id: "network", label: "Network" },
  { id: "web3", label: "Web3" },
];
