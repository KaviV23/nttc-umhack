-- Insert into transaction_data, ignore if order_id already exists
INSERT INTO transaction_data (
    id,
    order_id,
    order_time,
    driver_arrival_time,
    driver_pickup_time,
    delivery_time,
    order_value,
    eater_id,
    merchant_id
)
SELECT
    id,
    order_id,
    order_time,
    driver_arrival_time,
    driver_pickup_time,
    delivery_time,
    order_value,
    eater_id,
    merchant_id
FROM transaction_data_staging
ON CONFLICT (order_id) DO NOTHING;

-- Insert into transaction_items (skip merchant_id)
INSERT INTO transaction_items (
    id,
    order_id,
    item_id
)
SELECT
    id,
    order_id,
    item_id
FROM transaction_items_staging;

-- Deduplicate and insert new_transaction_items
INSERT INTO new_transaction_items (
    order_id,
    merchant_id,
    item_id,
    quantity
)
SELECT DISTINCT
    order_id,
    merchant_id,
    item_id,
    quantity
FROM new_transaction_items_staging;

-- Drop the staging tables
DROP TABLE transaction_data_staging;
DROP TABLE transaction_items_staging;
DROP TABLE new_transaction_items_staging;

-- Add padding to dates in merchants
UPDATE merchants
SET join_date = LPAD(join_date, 8, '0')
WHERE LENGTH(join_date) < 8;

-- Convert from text to date type
ALTER TABLE merchants ADD COLUMN join_date_converted DATE;

UPDATE merchants
SET join_date_converted = TO_DATE(join_date, 'DDMMYYYY');

ALTER TABLE merchants DROP COLUMN join_date;
ALTER TABLE merchants RENAME COLUMN join_date_converted TO join_date;
