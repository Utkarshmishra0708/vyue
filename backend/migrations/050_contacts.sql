CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  designation VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  notes TEXT,
  business_unit VARCHAR(50) NOT NULL,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer_bu (customer_name, business_unit)
)
