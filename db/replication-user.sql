-- creates a dedicated user for binlog reader (cdc client).
-- only 2 grants will be given [least privilege]

CREATE USER IF NOT EXISTS 'cdc_user'@'localhost' IDENTIFIED BY 'cdc_password';

GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'cdc_user'@'localhost';

GRANT SELECT ON realtime_orders.* TO 'cdc_user'@'localhost';

FLUSH PRIVILEGES;