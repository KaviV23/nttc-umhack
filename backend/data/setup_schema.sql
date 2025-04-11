-- Drop tables in correct order to avoid FK conflicts
DROP TABLE IF EXISTS transaction_items;
DROP TABLE IF EXISTS transaction_data;
DROP TABLE IF EXISTS keywords;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS merchants;

-- Create 'merchants' table
CREATE TABLE merchants (
    merchant_id CHAR(5) PRIMARY KEY,
    merchant_name VARCHAR(255) NOT NULL,
    join_date DATE NOT NULL,
    city_id INT
);

-- Create 'items' table
CREATE TABLE items (
    item_id INT PRIMARY KEY,
    cuisine_tag VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    item_price DECIMAL(10, 2) NOT NULL,
    merchant_id CHAR(5) NOT NULL,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

-- Create 'keywords' table
CREATE TABLE keywords (
    id INT PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL,
    view INT DEFAULT 0,
    menu INT DEFAULT 0,
    checkout INT DEFAULT 0,
    order_count INT DEFAULT 0
);

-- Create 'transaction_data' table
CREATE TABLE transaction_data (
    id INT PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    order_time TIMESTAMP NOT NULL,
    driver_arrival_time TIMESTAMP,
    driver_pickup_time TIMESTAMP,
    delivery_time TIMESTAMP,
    order_value DECIMAL(10, 2) NOT NULL,
    eater_id INT,
    merchant_id CHAR(5) NOT NULL,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

-- Create 'transaction_items' table
CREATE TABLE transaction_items (
    id INT PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    item_id INT NOT NULL,
    merchant_id CHAR(5) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES transaction_data(order_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);
