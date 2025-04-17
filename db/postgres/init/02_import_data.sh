#!/bin/bash
set -e
dataDir="/docker-entrypoint-initdb.d/data"

# Use the env vars provided by the Postgres container
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    \copy merchants(merchant_id, merchant_name, join_date, city_id) FROM '$dataDir/merchant.csv' DELIMITER ',' CSV HEADER;
    \copy items(item_id, cuisine_tag, item_name, item_price, merchant_id) FROM '$dataDir/items.csv' DELIMITER ',' CSV HEADER;
    \copy keywords(id, keyword, view, menu, checkout, order_count) FROM '$dataDir/keywords.csv' DELIMITER ',' CSV HEADER;
    \copy transaction_data_staging(id, order_id, order_time, driver_arrival_time, driver_pickup_time, delivery_time, order_value, eater_id, merchant_id) FROM '$dataDir/transaction_data.csv' DELIMITER ',' CSV HEADER;
    \copy transaction_items_staging(id, order_id, item_id, merchant_id) FROM '$dataDir/transaction_items.csv' DELIMITER ',' CSV HEADER;
EOSQL
