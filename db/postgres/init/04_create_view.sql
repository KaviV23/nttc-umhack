CREATE OR REPLACE VIEW combined_order_view AS
SELECT
  ti.order_id,
  td.merchant_id           AS order_merchant_id,
  ti.item_id,
  i.item_name,
  i.item_price,
  ti.quantity,
  (i.item_price * ti.quantity)::numeric(10,2) AS subtotal,
  i.merchant_id            AS item_merchant_id,
  m.merchant_name,
  td.order_value,
  td.order_time,
  td.driver_arrival_time,
  td.driver_pickup_time,
  td.delivery_time
FROM new_transaction_items ti
JOIN transaction_data td ON ti.order_id = td.order_id
JOIN items i             ON ti.item_id = i.item_id
JOIN merchants m         ON i.merchant_id = m.merchant_id;
