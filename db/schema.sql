-- schema for the realtime_orders database

CREATE DATABASE IF NOT EXISTS realtime_orders;
USE realtime_orders;

DROP TABLE IF EXISTS orders;

CREATE TABLE orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  product_name  VARCHAR(255) NOT NULL,
  status        ENUM('pending', 'shipped', 'delivered') NOT NULL DEFAULT 'pending',
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP
);

-- seeding data to get started
INSERT INTO orders (customer_name, product_name, status) VALUES
  ('Asha Kulkarni',  'Wireless Headphones', 'pending'),
  ('Rohan Mehta',    'Mechanical Keyboard', 'shipped'),
  ('Priya Sharma',   'Standing Desk',       'delivered');