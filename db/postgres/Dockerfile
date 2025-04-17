FROM postgres:17.4-bookworm

# Copy initialization scripts
COPY init/ /docker-entrypoint-initdb.d/
# Ensure the shell scripts are executable
RUN chmod +x /docker-entrypoint-initdb.d/*.sh
