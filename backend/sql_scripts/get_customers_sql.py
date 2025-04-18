def get_customers_sql(merchant_id):
  return f'''-- Replace 'M1234' with the desired merchant ID
WITH customer_orders AS (
    SELECT
        td.eater_id,
        td.order_time,
        ti.item_id,
        i.item_name,
        td.merchant_id
    FROM
        transaction_data td
    JOIN transaction_items ti ON td.order_id = ti.order_id
    JOIN items i ON ti.item_id = i.item_id
    WHERE
        td.merchant_id = '{merchant_id}'
),
last_order AS (
    SELECT
        eater_id,
        MAX(order_time) AS last_order_date
    FROM
        customer_orders
    GROUP BY
        eater_id
),
favorite_food AS (
    SELECT
        eater_id,
        item_name,
        COUNT(*) AS item_count,
        ROW_NUMBER() OVER (PARTITION BY eater_id ORDER BY COUNT(*) DESC) AS rn
    FROM
        customer_orders
    GROUP BY
        eater_id, item_name
)
SELECT
    lo.eater_id AS customer_id,
    lo.last_order_date,
    ff.item_name AS favorite_food
FROM
    last_order lo
JOIN favorite_food ff ON lo.eater_id = ff.eater_id AND ff.rn = 1
ORDER BY
    lo.last_order_date DESC;
'''