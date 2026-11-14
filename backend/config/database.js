const path = require('path');
const { Sequelize } = require('sequelize');

// Database settings come from backend\.env, or from the host's own settings when hosted.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const env = process.env;

const sequelize = new Sequelize(
  env.DB_NAME || 'sales_crm',
  env.DB_USER || 'root',
  env.DB_PASSWORD || '',
  {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
    define: { timestamps: true, underscored: false },
  }
);

module.exports = sequelize;
