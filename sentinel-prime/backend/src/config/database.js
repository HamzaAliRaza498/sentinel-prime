const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.SENTINEL_PRIME_CRIME,      // Database name
    process.env.SENTINEL_PRIME_CRIME,      // Username (postgres)
    process.env.baltee07,  // Password
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,  // Set to true to see SQL queries
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connected successfully!');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
};

module.exports = { sequelize, testConnection };